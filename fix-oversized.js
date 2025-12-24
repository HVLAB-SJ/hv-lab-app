const https = require("https");
const crypto = require("crypto");
const serviceAccount = require("./serviceAccountKey.json");

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U";
const PROJECT_ID = "hv-lab-app";
const BUCKET = "hv-lab-app.firebasestorage.app";

const failedItems = [
  { id: 160, name: "NEOREST NX" },
  { id: 157, name: "웨이브 R 투피스" },
  { id: 78, name: "웨이브 S 투피스" },
  { id: 84, name: "모노플러스 8000" }
];

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getFirestoreToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600
  };
  const signatureInput = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(payload));
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = signatureInput + "." + signature;

  return new Promise((resolve, reject) => {
    const postData = "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt;
    const req = https.request({
      hostname: "oauth2.googleapis.com", path: "/token", method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": postData.length }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(JSON.parse(data).access_token));
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function getItemFromRailway(itemId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.hvlab.app",
      path: "/api/specbook/item/" + itemId,
      method: "GET",
      headers: { "Authorization": "Bearer " + TOKEN }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
    req.end();
  });
}

function getStorageUrl(itemId, imageType, ext) {
  const path = encodeURIComponent("specbook/" + itemId + "/" + imageType + "." + ext);
  return "https://firebasestorage.googleapis.com/v0/b/" + BUCKET + "/o/" + path + "?alt=media";
}

function convertToFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(v => convertToFirestoreValue(v)) } };
  if (typeof value === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(value)) fields[k] = convertToFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function isBase64(str) { return str && typeof str === "string" && (str.startsWith("data:image/") || str.length > 1000); }

function replaceBase64WithUrl(itemId, imageData, subIndex) {
  if (!isBase64(imageData)) return imageData;
  let ext = "jpg";
  if (imageData.startsWith("data:image/png")) ext = "png";
  else if (imageData.startsWith("data:image/webp")) ext = "webp";
  const imageType = subIndex !== null && subIndex !== undefined ? "sub_" + subIndex : "main";
  return getStorageUrl(itemId, imageType, ext);
}

async function deleteFirestoreDoc(accessToken, docId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "firestore.googleapis.com",
      path: "/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/specbook_items/" + docId,
      method: "DELETE",
      headers: { "Authorization": "Bearer " + accessToken }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(true));
    });
    req.on("error", reject);
    req.end();
  });
}

async function createFirestoreDoc(accessToken, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== "_id") fields[key] = convertToFirestoreValue(value);
    }
    const body = JSON.stringify({ fields });
    console.log("  문서 크기:", Buffer.byteLength(body).toLocaleString(), "bytes");

    const req = https.request({
      hostname: "firestore.googleapis.com",
      path: "/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/specbook_items?documentId=" + docId,
      method: "POST",
      headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, (res) => {
      let respData = "";
      res.on("data", chunk => respData += chunk);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(true);
        else reject(new Error("HTTP " + res.statusCode));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log("1MB 초과 아이템 수정 시작
");
  const firestoreToken = await getFirestoreToken();
  console.log("토큰 발급 완료
");

  let success = 0, failed = 0;

  for (const item of failedItems) {
    console.log("처리 중:", item.name, "(ID:", item.id + ")");
    try {
      const detail = await getItemFromRailway(item.id);
      if (detail.image) {
        console.log("  메인이미지:", detail.image.length.toLocaleString(), "-> URL");
        detail.image = replaceBase64WithUrl(item.id, detail.image, null);
      }
      if (detail.sub_images && Array.isArray(detail.sub_images)) {
        detail.sub_images = detail.sub_images.map((img, idx) => {
          console.log("  서브이미지", idx + ":", img.length.toLocaleString(), "-> URL");
          return replaceBase64WithUrl(item.id, img, idx);
        });
      }
      console.log("  기존 문서 삭제...");
      await deleteFirestoreDoc(firestoreToken, String(item.id));
      console.log("  새 문서 생성...");
      await createFirestoreDoc(firestoreToken, String(item.id), detail);
      console.log("  완료!
");
      success++;
    } catch (error) {
      console.log("  실패:", error.message, "
");
      failed++;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log("===== 결과 =====");
  console.log("성공:", success);
  console.log("실패:", failed);
}

main().catch(console.error);
