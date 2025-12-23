/**
 * Railway에서 Firestore로 execution_records 동기화
 */

const https = require('https');
const crypto = require('crypto');

const PROJECT_ID = 'hv-lab-app';
const serviceAccount = require('./serviceAccountKey.json');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getFirestoreToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signatureInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${signature}`;

  return new Promise((resolve, reject) => {
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
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

async function fetchFromRailway(endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: `/api${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON: ' + body.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getFirestoreDocIds(accessToken, collection) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?pageSize=500`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const ids = (result.documents || []).map(doc => doc.name.split('/').pop());
          resolve(ids);
        } catch (e) {
          reject(e);
        }
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

async function createFirestoreDoc(accessToken, collection, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== '_id') {
        fields[key] = convertToFirestoreValue(value);
      }
    }

    const body = JSON.stringify({ fields });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${docId}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== 실행내역(execution_records) Railway → Firestore 동기화 ===\n');

  try {
    // Firestore 토큰 발급
    console.log('Firestore 토큰 발급 중...');
    const firestoreToken = await getFirestoreToken();
    console.log('토큰 발급 완료\n');

    // Railway에서 실행내역 가져오기
    console.log('Railway에서 실행내역 가져오는 중...');
    const railwayRecords = await fetchFromRailway('/execution-records');
    console.log(`Railway: ${railwayRecords.length}개\n`);

    // Firestore에서 기존 문서 ID 가져오기
    console.log('Firestore 기존 문서 확인 중...');
    const existingIds = await getFirestoreDocIds(firestoreToken, 'execution_records');
    console.log(`Firestore 기존: ${existingIds.length}개\n`);

    // 누락된 실행내역 찾기
    const missingRecords = railwayRecords.filter(r => {
      const id = String(r.id);
      return !existingIds.includes(id);
    });
    console.log(`누락된 실행내역: ${missingRecords.length}개\n`);

    if (missingRecords.length === 0) {
      console.log('모든 실행내역이 이미 동기화되어 있습니다.');
      return;
    }

    // 누락된 실행내역 동기화
    let success = 0;
    let failed = 0;

    for (let i = 0; i < missingRecords.length; i++) {
      const record = missingRecords[i];
      const docId = String(record.id);

      try {
        await createFirestoreDoc(firestoreToken, 'execution_records', docId, record);
        success++;
        process.stdout.write(`\r[${i + 1}/${missingRecords.length}] 동기화 중... (성공: ${success}, 실패: ${failed})`);
      } catch (error) {
        failed++;
        console.log(`\n  실패 (ID: ${docId}): ${error.message}`);
      }

      await sleep(100);
    }

    console.log('\n\n=== 결과 ===');
    console.log(`성공: ${success}개`);
    console.log(`실패: ${failed}개`);
    console.log('동기화 완료!');

    // 동기화 후 총액 확인
    let railwayTotal = 0;
    railwayRecords.forEach(r => {
      railwayTotal += (r.total_amount || 0);
    });
    console.log(`\nRailway 총액: ${railwayTotal.toLocaleString()}원`);

  } catch (error) {
    console.error('에러:', error.message);
  }
}

main();
