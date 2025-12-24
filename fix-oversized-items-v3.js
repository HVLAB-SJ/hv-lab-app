const https = require('https');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';
const PROJECT_ID = 'hv-lab-app';

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
    scope: 'https://www.googleapis.com/auth/datastore',
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

// 대용량 이미지 데이터 제거
function removeOversizedData(detail) {
  const result = { ...detail };

  // image_url: 100KB 이상이면 플레이스홀더로 대체
  if (result.image_url && result.image_url.length > 100000) {
    result.image_url = 'OVERSIZED_USE_RAILWAY_API';
  }

  // sub_images: 각 요소가 100KB 이상이면 플레이스홀더로 대체
  if (result.sub_images && Array.isArray(result.sub_images)) {
    result.sub_images = result.sub_images.map((img, idx) => {
      if (img && img.length > 100000) {
        return 'OVERSIZED_' + idx + '_USE_RAILWAY_API';
      }
      return img;
    });
  }

  // spec_image: 제거
  if (result.spec_image && result.spec_image.length > 100000) {
    result.spec_image = 'OVERSIZED_USE_RAILWAY_API';
  }

  // main_image: 제거
  if (result.main_image && result.main_image.length > 100000) {
    result.main_image = 'OVERSIZED_USE_RAILWAY_API';
  }

  // Railway API 폴백이 필요함을 표시
  result.needs_railway_fallback = true;

  return result;
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

    if (docSize > 1000000) {
      reject(new Error('여전히 1MB 초과: ' + (docSize / 1024).toFixed(1) + 'KB'));
      return;
    }

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
  console.log('🔧 문서 크기 초과 아이템 처리 시작 (v3 - 대용량 이미지 제거)\n');

  const token = await getFirestoreToken();
  console.log('✅ 토큰 발급 완료\n');

  for (const item of failedItems) {
    console.log('📦 처리 중:', item.name, '(ID:', item.id + ')');

    try {
      const detail = await getItemFromRailway(item.id);

      // 원본 크기 표시
      const originalSize = JSON.stringify(detail).length;
      console.log('  원본 크기:', (originalSize / 1024).toFixed(1) + 'KB');

      // 대용량 데이터 제거
      const cleanDetail = removeOversizedData(detail);
      const cleanSize = JSON.stringify(cleanDetail).length;
      console.log('  정리 후:', (cleanSize / 1024).toFixed(1) + 'KB');

      // 기존 문서 삭제 시도
      try {
        await deleteFirestoreDoc(token, String(item.id));
        console.log('  🗑️ 기존 문서 삭제');
      } catch (e) {}

      // 새 문서 생성
      await createFirestoreDoc(token, String(item.id), cleanDetail);
      console.log('  ✅ Firestore 저장 완료 (Railway 폴백 필요 표시됨)\n');

    } catch (error) {
      console.log('  ❌ 실패:', error.message, '\n');
    }
  }

  console.log('🎉 완료!');
  console.log('\n참고: 이 아이템들은 needs_railway_fallback=true로 표시되었습니다.');
  console.log('프론트엔드에서 상세 조회 시 Railway API를 폴백으로 사용해야 합니다.');
}

main().catch(console.error);
