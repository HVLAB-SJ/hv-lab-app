/**
 * SQLite에서 비밀번호를 가져와 Firestore에 업데이트
 */

const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const crypto = require('crypto');
const path = require('path');

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
  console.log('🔐 비밀번호 동기화 시작\n');

  const dbPath = path.join(__dirname, 'database.db');
  const db = new sqlite3.Database(dbPath);

  const firestoreToken = await getFirestoreToken();
  console.log('✅ Firestore 토큰 발급 완료\n');

  db.all('SELECT id, username, password FROM users', [], async (err, rows) => {
    if (err) {
      console.error('SQLite 오류:', err);
      return;
    }

    console.log(`📥 ${rows.length}명 사용자 비밀번호 업데이트 중...\n`);

    for (const user of rows) {
      try {
        await updateFirestorePassword(firestoreToken, String(user.id), user.password);
        console.log(`  ✅ ${user.username} (ID: ${user.id})`);
      } catch (error) {
        console.log(`  ❌ ${user.username}: ${error.message}`);
      }
    }

    console.log('\n🎉 완료!');
    db.close();
  });
}

main();
