/**
 * 모든 스펙북 이미지를 Firebase Storage로 마이그레이션
 * - Railway에서 모든 아이템 조회
 * - Base64 이미지를 Firebase Storage로 업로드
 * - Firestore 문서를 Storage URL로 업데이트
 */

const https = require('https');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';
const PROJECT_ID = 'hv-lab-app';
const BUCKET = 'hv-lab-app.firebasestorage.app';

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/devstorage.read_write',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signatureInput = headerB64 + '.' + payloadB64;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = signatureInput + '.' + signature;

  return new Promise((resolve, reject) => {
    const postData = 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt;
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': postData.length }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).access_token));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function getItemList() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api/specbook/library/meta',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function getItemDetail(itemId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api/specbook/item/' + itemId,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

function isBase64Image(str) {
  if (typeof str !== 'string') return false;
  if (str.startsWith('http://') || str.startsWith('https://')) return false;
  return str.startsWith('data:') || str.length > 1000;
}

function getContentType(base64Data) {
  if (base64Data.startsWith('data:')) {
    const match = base64Data.match(/data:([^;]+);/);
    if (match) return match[1];
  }
  return 'image/jpeg';
}

function getExtension(contentType) {
  const ext = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf'
  };
  return ext[contentType] || 'jpg';
}

async function uploadToStorage(accessToken, path, base64Data) {
  return new Promise((resolve, reject) => {
    let pureBase64 = base64Data;
    if (base64Data.includes(',')) {
      pureBase64 = base64Data.split(',')[1];
    }

    const buffer = Buffer.from(pureBase64, 'base64');
    const encodedPath = encodeURIComponent(path);
    const contentType = getContentType(base64Data);

    const req = https.request({
      hostname: 'storage.googleapis.com',
      path: `/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodedPath}`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': contentType,
        'Content-Length': buffer.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media`;
          resolve(publicUrl);
        } else {
          reject(new Error('Storage upload failed: ' + res.statusCode));
        }
      });
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

function convertToFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  } else if (typeof value === 'string') {
    return { stringValue: value };
  } else if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  } else if (typeof value === 'boolean') {
    return { booleanValue: value };
  } else if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(v => convertToFirestoreValue(v)) } };
  } else if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = convertToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

async function deleteFirestoreDoc(accessToken, docId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/specbook_items/${docId}`,
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + accessToken }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(true));
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function createFirestoreDoc(accessToken, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== '_id' && key !== 'id') {
        fields[key] = convertToFirestoreValue(value);
      }
    }
    fields['id'] = { integerValue: String(docId) };

    const body = JSON.stringify({ fields });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/specbook_items?documentId=${docId}`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error('Create failed: ' + res.statusCode + ' ' + data.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 파일명|data:... 형식 처리
function extractFilename(subImage) {
  if (typeof subImage !== 'string') return { filename: null, data: null };

  if (subImage.includes('|data:')) {
    const parts = subImage.split('|');
    return { filename: parts[0], data: parts.slice(1).join('|') };
  }

  if (subImage.startsWith('data:')) {
    return { filename: null, data: subImage };
  }

  if (subImage.length > 10000) {
    return { filename: null, data: subImage };
  }

  return { filename: subImage, data: null };
}

async function processItem(accessToken, item, index, total) {
  const detail = await getItemDetail(item.id);
  if (!detail) throw new Error('Item not found');

  const processedItem = { ...detail };
  let uploadCount = 0;

  // image_url 처리
  if (detail.image_url && isBase64Image(detail.image_url)) {
    try {
      const contentType = getContentType(detail.image_url);
      const ext = getExtension(contentType);
      const path = `specbook/${item.id}/main.${ext}`;
      const url = await uploadToStorage(accessToken, path, detail.image_url);
      processedItem.image_url = url;
      uploadCount++;
    } catch (e) {
      console.log(`    ⚠️ image_url 업로드 실패`);
    }
  }

  // image 필드 처리 (레거시)
  if (detail.image && isBase64Image(detail.image)) {
    try {
      const contentType = getContentType(detail.image);
      const ext = getExtension(contentType);
      const path = `specbook/${item.id}/image.${ext}`;
      const url = await uploadToStorage(accessToken, path, detail.image);
      processedItem.image = url;
      uploadCount++;
    } catch (e) {
      console.log(`    ⚠️ image 업로드 실패`);
    }
  }

  // sub_images 처리
  if (Array.isArray(detail.sub_images) && detail.sub_images.length > 0) {
    const newSubImages = [];
    for (let i = 0; i < detail.sub_images.length; i++) {
      const img = detail.sub_images[i];
      const { filename, data } = extractFilename(img);

      if (data && data.length > 1000) {
        try {
          const contentType = getContentType(data);
          const ext = getExtension(contentType);
          const path = `specbook/${item.id}/sub_${i}.${ext}`;
          const url = await uploadToStorage(accessToken, path, data);
          newSubImages.push(filename ? `${filename}|${url}` : url);
          uploadCount++;
        } catch (e) {
          newSubImages.push(filename || '[업로드 실패]');
        }
      } else if (filename) {
        newSubImages.push(filename);
      } else {
        newSubImages.push(img);
      }
    }
    processedItem.sub_images = newSubImages;
  }

  // Firestore 저장
  if (uploadCount > 0) {
    await deleteFirestoreDoc(accessToken, String(item.id));
    await createFirestoreDoc(accessToken, String(item.id), processedItem);
  }

  return uploadCount;
}

async function main() {
  console.log('🚀 모든 스펙북 이미지 Firebase Storage 마이그레이션\n');
  console.log('버킷:', BUCKET + '\n');

  const accessToken = await getAccessToken();
  console.log('✅ 토큰 발급 완료\n');

  const items = await getItemList();
  console.log(`📦 총 ${items.length}개 아이템 처리 예정\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;
  let totalUploads = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const uploadCount = await processItem(accessToken, item, i, items.length);

      if (uploadCount > 0) {
        success++;
        totalUploads += uploadCount;
        console.log(`  ✅ [${i+1}/${items.length}] ${item.name} - ${uploadCount}개 업로드`);
      } else {
        skipped++;
      }
    } catch (error) {
      failed++;
      console.log(`  ❌ [${i+1}/${items.length}] ${item.name}: ${error.message.substring(0, 50)}`);
    }

    // 진행률 표시
    if ((i + 1) % 10 === 0) {
      console.log(`  --- 진행: ${i+1}/${items.length} (성공: ${success}, 스킵: ${skipped}, 실패: ${failed}) ---`);
    }

    await new Promise(r => setTimeout(r, 300)); // 속도 조절
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 마이그레이션 완료!');
  console.log(`  - 이미지 업로드: ${totalUploads}개`);
  console.log(`  - 성공 아이템: ${success}개`);
  console.log(`  - 스킵 (이미지 없음): ${skipped}개`);
  console.log(`  - 실패: ${failed}개`);
}

main().catch(console.error);
