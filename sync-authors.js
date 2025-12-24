/**
 * Railway에서 Firestore로 실행내역의 author 필드만 업데이트
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

async function fetchFromRailway() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api/execution-records',
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
          reject(new Error('Invalid JSON'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function updateFirestoreAuthor(accessToken, docId, author) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      fields: {
        author: { stringValue: author || '' }
      }
    });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/execution_records/${docId}?updateMask.fieldPaths=author`,
      method: 'PATCH',
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
          reject(new Error(`HTTP ${res.statusCode}`));
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
  console.log('=== 실행내역 작성자(author) 업데이트 ===\n');

  try {
    console.log('Firestore 토큰 발급 중...');
    const firestoreToken = await getFirestoreToken();
    console.log('토큰 발급 완료\n');

    console.log('Railway에서 실행내역 가져오는 중...');
    const railwayRecords = await fetchFromRailway();
    console.log(`총 ${railwayRecords.length}개\n`);

    // 작성자가 있는 레코드만 필터링
    const recordsWithAuthor = railwayRecords.filter(r => r.author && r.author.trim());
    console.log(`작성자 있는 레코드: ${recordsWithAuthor.length}개\n`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < recordsWithAuthor.length; i++) {
      const record = recordsWithAuthor[i];
      const docId = String(record.id);

      try {
        await updateFirestoreAuthor(firestoreToken, docId, record.author);
        success++;
        process.stdout.write(`\r[${i + 1}/${recordsWithAuthor.length}] 업데이트 중... (성공: ${success}, 실패: ${failed})`);
      } catch (error) {
        failed++;
        // 문서가 없으면 스킵
      }

      await sleep(50);
    }

    console.log('\n\n=== 결과 ===');
    console.log(`성공: ${success}개`);
    console.log(`실패: ${failed}개`);
    console.log('작성자 업데이트 완료!');

  } catch (error) {
    console.error('에러:', error.message);
  }
}

main();
