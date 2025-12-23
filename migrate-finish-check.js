/**
 * 마감체크 데이터를 Railway에서 Firestore로 마이그레이션
 */

const https = require('https');
const crypto = require('crypto');

const PROJECT_ID = 'hv-lab-app';
const serviceAccount = require('./serviceAccountKey.json');
const RAILWAY_API = 'api.hvlab.app';
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
      hostname: RAILWAY_API,
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

async function createFirestoreDocument(accessToken, collection, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        fields[key] = { nullValue: null };
      } else if (typeof value === 'string') {
        fields[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          fields[key] = { integerValue: String(value) };
        } else {
          fields[key] = { doubleValue: value };
        }
      } else if (typeof value === 'boolean') {
        fields[key] = { booleanValue: value };
      } else if (Array.isArray(value)) {
        fields[key] = {
          arrayValue: {
            values: value.map(v => {
              if (typeof v === 'string') return { stringValue: v };
              if (typeof v === 'number') return { integerValue: String(v) };
              return { stringValue: String(v) };
            })
          }
        };
      }
    }

    const body = JSON.stringify({ fields });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`,
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
          reject(new Error(`Firestore error: ${res.statusCode} - ${data}`));
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
  console.log('🚀 마감체크 데이터 마이그레이션 시작\n');

  try {
    // Firestore 토큰 발급
    console.log('🔑 Firestore 토큰 발급 중...');
    const firestoreToken = await getFirestoreToken();
    console.log('✅ 토큰 발급 완료\n');

    // Railway에서 마감체크 데이터 가져오기
    console.log('📥 Railway에서 마감체크 데이터 가져오는 중...');
    const spacesData = await fetchFromRailway('/finish-check/spaces');
    console.log(`  총 ${spacesData.length}개 공간\n`);

    let totalItems = 0;
    let successSpaces = 0;
    let successItems = 0;

    // 각 공간 처리
    for (let i = 0; i < spacesData.length; i++) {
      const space = spacesData[i];
      process.stdout.write(`\r[${i + 1}/${spacesData.length}] ${space.name} 처리 중...                    `);

      try {
        // 공간 데이터 저장
        await createFirestoreDocument(firestoreToken, 'finish_check_spaces', String(space.id), {
          name: space.name,
          order_index: space.order_index || i,
          created_at: space.created_at || new Date().toISOString()
        });
        successSpaces++;

        // 해당 공간의 아이템 처리
        if (space.items && Array.isArray(space.items)) {
          for (const item of space.items) {
            totalItems++;
            try {
              await createFirestoreDocument(firestoreToken, 'finish_check_items', String(item.id), {
                space_id: item.space_id,
                name: item.name,
                order_index: item.order_index || 0,
                created_at: item.created_at || new Date().toISOString()
              });
              successItems++;
            } catch (e) {
              console.log(`\n  ⚠️ 아이템 저장 실패 (${item.name}): ${e.message}`);
            }
            await sleep(50); // API 속도 제한
          }
        }

        await sleep(100);
      } catch (e) {
        console.log(`\n  ⚠️ 공간 저장 실패 (${space.name}): ${e.message}`);
      }
    }

    console.log('\n\n📊 결과 요약:');
    console.log(`  공간: ${successSpaces}/${spacesData.length}개 성공`);
    console.log(`  아이템: ${successItems}/${totalItems}개 성공`);
    console.log('\n🎉 마이그레이션 완료!');

  } catch (error) {
    console.error('\n❌ 오류:', error.message);
  }
}

main();
