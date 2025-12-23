/**
 * 나머지 테이블 마이그레이션
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const PROJECT_ID = 'hv-lab-app';
const serviceAccount = require('./serviceAccountKey.json');

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken() {
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

const dbPath = path.join(__dirname, 'database.db');
const sqliteDb = new sqlite3.Database(dbPath);

const dbAll = (query) => {
  return new Promise((resolve, reject) => {
    sqliteDb.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

async function migrateTable(accessToken, tableName, collectionName) {
  try {
    const rows = await dbAll(`SELECT * FROM ${tableName}`);
    if (rows.length === 0) {
      console.log(`  ⚪ ${tableName}: 데이터 없음`);
      return 0;
    }

    for (const row of rows) {
      const docId = row.id ? String(row.id) : String(Date.now() + Math.random());
      await writeToFirestore(accessToken, collectionName, docId, row);
    }
    console.log(`  ✓ ${tableName}: ${rows.length}개`);
    return rows.length;
  } catch (error) {
    console.log(`  ⚠️ ${tableName}: ${error.message}`);
    return 0;
  }
}

async function main() {
  console.log('🚀 나머지 테이블 마이그레이션\n');

  const accessToken = await getAccessToken();
  console.log('🔑 토큰 발급 완료\n');

  const tables = [
    'payment_requests',
    'as_requests',
    'work_requests',
    'additional_works',
    'construction_payments',
    'contractors',
    'quote_inquiries',
    'specbook_items',
    'specbook_categories',
    'site_logs',
    'drawings',
    'execution_records',
    'processes'
  ];

  let total = 0;
  for (const table of tables) {
    const count = await migrateTable(accessToken, table, table);
    total += count;
  }

  console.log(`\n🎉 총 ${total}개 데이터 마이그레이션 완료!`);
  sqliteDb.close();
}

main();
