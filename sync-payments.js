/**
 * 결제요청 데이터 개별 동기화 (큰 데이터 처리)
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
          reject(new Error('Invalid JSON'));
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
    // 문자열이 너무 길면 자르기
    if (value.length > 100000) {
      return { stringValue: value.substring(0, 100000) };
    }
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
    // 배열 크기 제한
    const limitedArray = value.slice(0, 100);
    return {
      arrayValue: {
        values: limitedArray.map(v => convertToFirestoreValue(v))
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

    // 큰 필드 제외하고 저장
    const skipFields = ['_id', 'receipt_image', 'receipt_data', 'attachments'];

    for (const [key, value] of Object.entries(data)) {
      if (!skipFields.includes(key)) {
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
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!TOKEN) {
    console.log('사용법: node sync-payments.js <JWT_TOKEN>');
    process.exit(1);
  }

  console.log('🚀 결제요청 동기화 시작\n');

  try {
    const firestoreToken = await getFirestoreToken();
    console.log('✅ Firestore 토큰 발급 완료\n');

    console.log('📥 결제요청 데이터 가져오는 중...');
    const payments = await fetchFromRailway('/payments');
    console.log(`  총 ${payments.length}개 결제요청\n`);

    let success = 0;
    let failed = 0;

    for (const payment of payments) {
      try {
        const docId = String(payment.id || payment._id);
        await writeToFirestore(firestoreToken, 'payment_requests', docId, payment);
        success++;
        process.stdout.write(`\r  진행: ${success}/${payments.length}`);
      } catch (error) {
        failed++;
      }
    }

    console.log(`\n\n🎉 완료! 성공: ${success}, 실패: ${failed}`);
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

main();
