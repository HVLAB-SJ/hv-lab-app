const https = require('https');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';
const PROJECT_ID = 'hv-lab-app';
const BUCKET = 'hv-lab-app.firebasestorage.app';

// 문서 크기 초과로 실패한 아이템들
const failedItems = [
  { id: 160, name: 'NEOREST NX' },
  { id: 157, name: '웨이브 R 투피스' },
  { id: 78, name: '웨이브 S 투피스' },
  { id: 84, name: '모노플러스 8000' }
];

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getFirestoreToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/devstorage.full_control',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signatureInput = headerB64 + '.' + payloadB64;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
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

async function getItemFromRailway(itemId) {
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

// base64 데이터인지 확인 (data: 접두사 또는 긴 문자열)
function isBase64Image(str) {
  if (!str || typeof str !== 'string') return false;
  // data:image/... 형식
  if (str.startsWith('data:')) return true;
  // 1MB 이상이면 base64 데이터로 간주
  if (str.length > 1000000) return true;
  return false;
}

// base64 데이터에서 콘텐츠 타입과 바이너리 추출
function parseBase64(data) {
  // data:image/jpeg;base64,... 형식인 경우
  if (data.startsWith('data:')) {
    const matches = data.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      return {
        contentType: matches[1],
        buffer: Buffer.from(matches[2], 'base64')
      };
    }
  }

  // 순수 base64 데이터인 경우 (PDF 또는 이미지)
  try {
    const buffer = Buffer.from(data, 'base64');
    // PDF 시그니처 확인 (%PDF)
    if (buffer.slice(0, 4).toString() === '%PDF') {
      return { contentType: 'application/pdf', buffer };
    }
    // JPEG 시그니처 확인 (FFD8FF)
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { contentType: 'image/jpeg', buffer };
    }
    // PNG 시그니처 확인
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return { contentType: 'image/png', buffer };
    }
    // 기본값으로 octet-stream
    return { contentType: 'application/octet-stream', buffer };
  } catch (e) {
    return null;
  }
}

async function uploadToStorage(accessToken, filePath, data) {
  return new Promise((resolve, reject) => {
    const parsed = parseBase64(data);
    if (!parsed) {
      reject(new Error('Invalid data format'));
      return;
    }

    const { contentType, buffer } = parsed;
    const encodedPath = encodeURIComponent(filePath);

    const req = https.request({
      hostname: 'storage.googleapis.com',
      path: '/upload/storage/v1/b/' + BUCKET + '/o?uploadType=media&name=' + encodedPath,
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
          const url = 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodedPath + '?alt=media';
          resolve(url);
        } else {
          reject(new Error('Upload failed: ' + res.statusCode + ' - ' + data.substring(0, 100)));
        }
      });
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

async function deleteFirestoreDoc(accessToken, docId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/specbook_items/' + docId,
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + accessToken }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(true));
    });
    req.on('error', reject);
    req.end();
  });
}

function convertToFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(v => convertToFirestoreValue(v)) } };
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) fields[k] = convertToFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

async function createFirestoreDoc(accessToken, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== '_id') fields[key] = convertToFirestoreValue(value);
    }
    const body = JSON.stringify({ fields });

    // 문서 크기 확인
    const docSize = Buffer.byteLength(body);
    console.log('    문서 크기:', (docSize / 1024).toFixed(1) + 'KB');

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/specbook_items?documentId=' + docId,
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
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(true);
        else reject(new Error('Create failed: ' + res.statusCode + ' - ' + data.substring(0, 200)));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🔧 문서 크기 초과 아이템 처리 시작 (v2)\n');

  const token = await getFirestoreToken();
  console.log('✅ 토큰 발급 완료\n');

  for (const item of failedItems) {
    console.log('📦 처리 중:', item.name, '(ID:', item.id + ')');

    try {
      const detail = await getItemFromRailway(item.id);
      let uploadCount = 0;

      // image_url 업로드 (main_image가 아닌 image_url 필드)
      if (detail.image_url && isBase64Image(detail.image_url)) {
        try {
          const url = await uploadToStorage(token, 'specbook/' + item.id + '/main.jpg', detail.image_url);
          detail.image_url = url;
          uploadCount++;
          console.log('  ✅ image_url 업로드');
        } catch (e) {
          console.log('  ⚠️ image_url 업로드 실패:', e.message);
        }
      }

      // main_image 업로드
      if (detail.main_image && isBase64Image(detail.main_image)) {
        try {
          const url = await uploadToStorage(token, 'specbook/' + item.id + '/main_image.jpg', detail.main_image);
          detail.main_image = url;
          uploadCount++;
          console.log('  ✅ main_image 업로드');
        } catch (e) {
          console.log('  ⚠️ main_image 업로드 실패:', e.message);
        }
      }

      // spec_image 업로드
      if (detail.spec_image && isBase64Image(detail.spec_image)) {
        try {
          const url = await uploadToStorage(token, 'specbook/' + item.id + '/spec.pdf', detail.spec_image);
          detail.spec_image = url;
          uploadCount++;
          console.log('  ✅ spec_image 업로드');
        } catch (e) {
          console.log('  ⚠️ spec_image 업로드 실패:', e.message);
        }
      }

      // sub_images 업로드 - 모든 큰 데이터 업로드
      if (detail.sub_images && Array.isArray(detail.sub_images)) {
        for (let i = 0; i < detail.sub_images.length; i++) {
          const subImg = detail.sub_images[i];
          if (subImg && isBase64Image(subImg)) {
            try {
              // 파일 확장자 결정
              let ext = 'jpg';
              if (subImg.startsWith('data:application/pdf') || (subImg.length > 100 && Buffer.from(subImg.substring(0, 100), 'base64').toString().startsWith('%PDF'))) {
                ext = 'pdf';
              }
              const url = await uploadToStorage(token, 'specbook/' + item.id + '/sub_' + i + '.' + ext, subImg);
              detail.sub_images[i] = url;
              uploadCount++;
            } catch (e) {
              console.log('    ⚠️ sub_images[' + i + '] 업로드 실패:', e.message);
            }
          }
        }
        console.log('  ✅ sub_images 처리 완료 (' + detail.sub_images.length + '개 요소)');
      }

      // 기존 문서 삭제 시도
      try {
        await deleteFirestoreDoc(token, String(item.id));
        console.log('  🗑️ 기존 문서 삭제');
      } catch (e) {}

      // 새 문서 생성
      await createFirestoreDoc(token, String(item.id), detail);
      console.log('  ✅ Firestore 저장 완료 (', uploadCount, '개 이미지 업로드)\n');

    } catch (error) {
      console.log('  ❌ 실패:', error.message, '\n');
    }
  }

  console.log('🎉 완료!');
}

main().catch(console.error);
