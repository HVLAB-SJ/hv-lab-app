const https = require('https');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';
const PROJECT_ID = 'hv-lab-app';
const BUCKET_NAME = 'hv-lab-specbook-images';

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getToken(scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: scope,
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

  // 순수 base64 데이터인 경우
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
    return { contentType: 'application/octet-stream', buffer };
  } catch (e) {
    return null;
  }
}

function isBase64Image(str) {
  if (!str || typeof str !== 'string') return false;
  if (str.startsWith('data:')) return true;
  if (str.startsWith('http://') || str.startsWith('https://')) return false;
  if (str.length > 1000) return true; // 긴 문자열은 base64로 간주
  return false;
}

async function uploadToGCS(gcsToken, filePath, data) {
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
      path: '/upload/storage/v1/b/' + BUCKET_NAME + '/o?uploadType=media&name=' + encodedPath,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + gcsToken,
        'Content-Type': contentType,
        'Content-Length': buffer.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const url = 'https://storage.googleapis.com/' + BUCKET_NAME + '/' + encodedPath;
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

async function deleteFirestoreDoc(firestoreToken, docId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/specbook_items/' + docId,
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + firestoreToken }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(true));
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function createFirestoreDoc(firestoreToken, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== '_id' && key !== 'id') {
        fields[key] = convertToFirestoreValue(value);
      }
    }
    const body = JSON.stringify({ fields });
    const docSize = Buffer.byteLength(body);

    if (docSize > 900000) {
      reject(new Error('문서 크기 초과: ' + (docSize / 1024).toFixed(1) + 'KB'));
      return;
    }

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/specbook_items?documentId=' + docId,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + firestoreToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ size: docSize });
        } else if (res.statusCode === 409) {
          resolve({ size: docSize, exists: true });
        } else {
          reject(new Error('HTTP ' + res.statusCode + ': ' + data.substring(0, 100)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🔄 스펙북 이미지 -> GCS 마이그레이션 시작\n');

  const gcsToken = await getToken('https://www.googleapis.com/auth/devstorage.full_control');
  const firestoreToken = await getToken('https://www.googleapis.com/auth/datastore');
  console.log('✅ 토큰 발급 완료\n');

  const items = await getItemList();
  console.log('📦 Railway에서', items.length, '개 아이템 조회\n');

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const detail = await getItemDetail(item.id);
      let uploadCount = 0;
      let needsUpdate = false;

      // image_url 처리
      if (detail.image_url && isBase64Image(detail.image_url)) {
        try {
          const ext = detail.image_url.includes('pdf') ? 'pdf' : 'jpg';
          const url = await uploadToGCS(gcsToken, 'specbook/' + item.id + '/main.' + ext, detail.image_url);
          detail.image_url = url;
          uploadCount++;
          needsUpdate = true;
        } catch (e) {
          console.log('    ⚠️ image_url 업로드 실패:', e.message);
        }
      }

      // sub_images 처리
      if (detail.sub_images && Array.isArray(detail.sub_images)) {
        const newSubImages = [];
        for (let j = 0; j < detail.sub_images.length; j++) {
          const img = detail.sub_images[j];
          if (img && isBase64Image(img)) {
            try {
              const ext = img.includes('pdf') ? 'pdf' : 'jpg';
              const url = await uploadToGCS(gcsToken, 'specbook/' + item.id + '/sub_' + j + '.' + ext, img);
              newSubImages.push(url);
              uploadCount++;
              needsUpdate = true;
            } catch (e) {
              newSubImages.push(img); // 실패시 원본 유지
            }
          } else {
            newSubImages.push(img);
          }
        }
        detail.sub_images = newSubImages;
      }

      // Firestore 업데이트
      if (needsUpdate || uploadCount > 0) {
        await deleteFirestoreDoc(firestoreToken, String(item.id));
        await createFirestoreDoc(firestoreToken, String(item.id), detail);
        success++;
        console.log('  ✅', item.name, '- 업로드:', uploadCount);
      } else {
        // 업로드 없이 Firestore만 업데이트
        await deleteFirestoreDoc(firestoreToken, String(item.id));
        await createFirestoreDoc(firestoreToken, String(item.id), detail);
        skipped++;
      }

      // 진행률 표시
      if ((i + 1) % 10 === 0) {
        console.log('  --- 진행:', i + 1, '/', items.length, '---');
      }

    } catch (error) {
      failed++;
      console.log('  ❌', item.name, ':', error.message);
    }

    // 속도 조절
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n🎉 마이그레이션 완료!');
  console.log('  - 이미지 업로드:', success);
  console.log('  - 이미지 없음 (Firestore만 업데이트):', skipped);
  console.log('  - 실패:', failed);
}

main().catch(console.error);
