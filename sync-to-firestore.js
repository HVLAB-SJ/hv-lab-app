/**
 * Railway API에서 데이터를 가져와 Firestore에 동기화
 */

const https = require('https');
const crypto = require('crypto');

const PROJECT_ID = 'hv-lab-app';
const serviceAccount = require('./serviceAccountKey.json');

// Railway API에서 로그인하고 데이터 가져오기
const RAILWAY_API = 'api.hvlab.app';

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

async function railwayLogin(username, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ username, password });
    const req = https.request({
      hostname: RAILWAY_API,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.token) {
          resolve(result.token);
        } else {
          reject(new Error(result.error || 'Login failed'));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function fetchFromRailway(token, endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: RAILWAY_API,
      path: `/api${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
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
      fields[key] = convertToFirestoreValue(value);
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
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function syncCollection(railwayToken, firestoreToken, endpoint, collection, idField = 'id') {
  try {
    console.log(`\n📥 ${collection} 동기화 중...`);
    const data = await fetchFromRailway(railwayToken, endpoint);

    if (!Array.isArray(data)) {
      console.log(`  ⚠️ ${collection}: 배열이 아님`, typeof data);
      return 0;
    }

    if (data.length === 0) {
      console.log(`  ⚪ ${collection}: 데이터 없음`);
      return 0;
    }

    for (const item of data) {
      const docId = String(item[idField] || item._id || Date.now() + Math.random());
      await writeToFirestore(firestoreToken, collection, docId, item);
    }

    console.log(`  ✅ ${collection}: ${data.length}개 동기화 완료`);
    return data.length;
  } catch (error) {
    console.log(`  ❌ ${collection}: ${error.message}`);
    return 0;
  }
}

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.log('사용법: node sync-to-firestore.js <username> <password>');
    process.exit(1);
  }

  console.log('🚀 Railway → Firestore 동기화 시작\n');

  try {
    // Railway 로그인
    console.log('🔑 Railway 로그인 중...');
    const railwayToken = await railwayLogin(username, password);
    console.log('✅ Railway 로그인 성공\n');

    // Firestore 토큰
    console.log('🔑 Firestore 토큰 발급 중...');
    const firestoreToken = await getFirestoreToken();
    console.log('✅ Firestore 토큰 발급 완료');

    // 동기화할 컬렉션들
    const collections = [
      { endpoint: '/projects', collection: 'projects' },
      { endpoint: '/schedules', collection: 'schedules', idField: '_id' },
      { endpoint: '/users', collection: 'users' },
      { endpoint: '/payments', collection: 'payment_requests' },
      { endpoint: '/contractors', collection: 'contractors' },
      { endpoint: '/processes', collection: 'processes' },
      { endpoint: '/workrequests', collection: 'work_requests' },
      { endpoint: '/as-requests', collection: 'as_requests' },
      { endpoint: '/additional-works', collection: 'additional_works' },
      { endpoint: '/construction-payments', collection: 'construction_payments' },
      { endpoint: '/specbook/categories', collection: 'specbook_categories' },
    ];

    let total = 0;
    for (const { endpoint, collection, idField } of collections) {
      const count = await syncCollection(railwayToken, firestoreToken, endpoint, collection, idField || 'id');
      total += count;
    }

    console.log(`\n🎉 총 ${total}개 데이터 동기화 완료!`);
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

main();
