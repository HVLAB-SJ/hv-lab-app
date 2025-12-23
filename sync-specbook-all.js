/**
 * Railway에서 Firestore로 스펙북 아이템 전체 동기화
 */

const https = require('https');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';
const PROJECT_ID = 'hv-lab-app';

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
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
  const signatureInput = `${headerB64}.${payloadB64}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${signatureInput}.${signature}`;

  return new Promise((resolve, reject) => {
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
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
      res.on('end', () => {
        const parsed = JSON.parse(data);
        // 데이터 유효성 검사 - name 필드가 있어야 유효한 아이템
        if (!parsed.name) {
          reject(new Error('Invalid item data: ' + (parsed.error || 'no name field')));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function convertToFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  } else if (typeof value === 'string') {
    return { stringValue: value };
  } else if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    } else {
      return { doubleValue: value };
    }
  } else if (typeof value === 'boolean') {
    return { booleanValue: value };
  } else if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(v => convertToFirestoreValue(v))
      }
    };
  } else if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = convertToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

// 문서 삭제
async function deleteFirestoreDoc(accessToken, docId) {
  return new Promise((resolve, reject) => {
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
    req.on('error', reject);
    req.end();
  });
}

// 문서 생성 (POST)
async function createFirestoreDoc(accessToken, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== '_id') {
        fields[key] = convertToFirestoreValue(value);
      }
    }

    const body = JSON.stringify({ fields });
    const bodySize = Buffer.byteLength(body);

    // 크기가 너무 크면 sub_images 제거
    if (bodySize > 900000) {
      delete fields.sub_images;
    }

    const finalBody = JSON.stringify({ fields });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/specbook_items?documentId=${docId}`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(finalBody)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else if (res.statusCode === 409) {
          // 이미 존재하면 성공으로 처리
          resolve(true);
        } else {
          reject(new Error('HTTP ' + res.statusCode + ': ' + data.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(finalBody);
    req.end();
  });
}

async function main() {
  console.log('=== Railway -> Firestore 스펙북 전체 동기화 (POST) ===\n');

  const firestoreToken = await getFirestoreToken();
  console.log('Firestore 토큰 발급 완료');

  // Railway에서 목록 조회
  const items = await getItemList();
  console.log('Railway 아이템:', items.length, '개\n');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const detail = await getItemDetail(item.id);

      // 기존 문서 삭제 후 생성
      await deleteFirestoreDoc(firestoreToken, String(item.id));
      await createFirestoreDoc(firestoreToken, String(item.id), detail);

      success++;
      process.stdout.write('\r[' + (i + 1) + '/' + items.length + '] 동기화 중... (성공: ' + success + ', 실패: ' + failed + ')');
    } catch (error) {
      failed++;
      console.log('\n실패 (ID ' + item.id + ' - ' + item.name + '): ' + error.message.substring(0, 100));
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n\n=== 결과 ===');
  console.log('성공:', success);
  console.log('실패:', failed);
}

main().catch(console.error);
