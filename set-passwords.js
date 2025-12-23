/**
 * 모든 사용자 비밀번호를 0109로 설정
 */

const https = require('https');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const PROJECT_ID = 'hv-lab-app';
const serviceAccount = require('./serviceAccountKey.json');

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

async function getUsers(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function updateFirestorePassword(accessToken, docId, password) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      fields: {
        password: { stringValue: password }
      }
    });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${docId}?updateMask.fieldPaths=password`,
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
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🔐 비밀번호 설정 시작\n');

  const firestoreToken = await getFirestoreToken();
  console.log('✅ Firestore 토큰 발급 완료\n');

  // 비밀번호 해시 생성
  const password = '0109';
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log(`🔑 비밀번호 '${password}' 해시 생성 완료\n`);

  // 사용자 목록 가져오기
  const usersData = await getUsers(firestoreToken);
  const users = usersData.documents || [];

  console.log(`📥 ${users.length}명 사용자 비밀번호 업데이트 중...\n`);

  for (const userDoc of users) {
    const docId = userDoc.name.split('/').pop();
    const username = userDoc.fields.username?.stringValue || 'Unknown';

    try {
      await updateFirestorePassword(firestoreToken, docId, hashedPassword);
      console.log(`  ✅ ${username} (ID: ${docId})`);
    } catch (error) {
      console.log(`  ❌ ${username}: ${error.message}`);
    }
  }

  console.log('\n🎉 완료! 모든 사용자 비밀번호: 0109');
}

main();
