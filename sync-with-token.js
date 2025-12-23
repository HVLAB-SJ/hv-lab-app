/**
 * Railway API에서 토큰으로 데이터를 가져와 Firestore에 동기화
 */

const https = require('https');
const crypto = require('crypto');

const PROJECT_ID = 'hv-lab-app';
const serviceAccount = require('./serviceAccountKey.json');
const RAILWAY_API = 'api.hvlab.app';
const TOKEN = process.argv[2];

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
          reject(new Error('Invalid JSON: ' + body.substring(0, 100)));
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

async function writeToFirestore(accessToken, collection, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== '_id') {
        fields[key] = convertToFirestoreValue(value);
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
          resolve(JSON.parse(data));
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

async function syncCollection(firestoreToken, endpoint, collection, idField = 'id') {
  try {
    console.log(`📥 ${collection} 동기화 중...`);
    const data = await fetchFromRailway(endpoint);

    if (!Array.isArray(data)) {
      console.log(`  ⚠️ 배열이 아님:`, typeof data, JSON.stringify(data).substring(0, 100));
      return 0;
    }

    if (data.length === 0) {
      console.log(`  ⚪ 데이터 없음`);
      return 0;
    }

    for (const item of data) {
      const docId = String(item[idField] || item._id || item.id || Date.now() + Math.random());
      await writeToFirestore(firestoreToken, collection, docId, item);
    }

    console.log(`  ✅ ${data.length}개 완료`);
    return data.length;
  } catch (error) {
    console.log(`  ❌ 오류: ${error.message}`);
    return 0;
  }
}

async function main() {
  if (!TOKEN) {
    console.log('사용법: node sync-with-token.js <JWT_TOKEN>');
    process.exit(1);
  }

  console.log('🚀 Railway → Firestore 동기화 시작\n');

  try {
    // Firestore 토큰
    console.log('🔑 Firestore 토큰 발급 중...');
    const firestoreToken = await getFirestoreToken();
    console.log('✅ Firestore 토큰 발급 완료\n');

    // 동기화할 컬렉션들
    const collections = [
      { endpoint: '/projects', collection: 'projects', idField: 'id' },
      { endpoint: '/schedules', collection: 'schedules', idField: '_id' },
      { endpoint: '/users', collection: 'users', idField: 'id' },
      { endpoint: '/payments', collection: 'payment_requests', idField: 'id' },
      { endpoint: '/contractors', collection: 'contractors', idField: 'id' },
      { endpoint: '/processes', collection: 'processes', idField: 'id' },
      { endpoint: '/workrequests', collection: 'work_requests', idField: 'id' },
      { endpoint: '/as-requests', collection: 'as_requests', idField: 'id' },
      { endpoint: '/additional-works', collection: 'additional_works', idField: 'id' },
      { endpoint: '/construction-payments', collection: 'construction_payments', idField: 'id' },
      { endpoint: '/specbook/categories', collection: 'specbook_categories', idField: 'id' },
    ];

    let total = 0;
    for (const { endpoint, collection, idField } of collections) {
      const count = await syncCollection(firestoreToken, endpoint, collection, idField);
      total += count;
    }

    console.log(`\n🎉 총 ${total}개 데이터 동기화 완료!`);
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

main();
