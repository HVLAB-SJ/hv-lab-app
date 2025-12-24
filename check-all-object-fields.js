/**
 * 모든 Firestore 컬렉션에서 객체형 필드 확인
 * {_id, name, username} 형태의 필드를 찾아서 문자열로 변환
 */

const https = require('https');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');
const PROJECT_ID = 'hv-lab-app';

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken() {
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
  const signatureInput = headerB64 + '.' + payloadB64;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = signatureInput + '.' + signature;

  return new Promise((resolve, reject) => {
    const postData = 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt;
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

async function getCollection(accessToken, collectionName) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=500`,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + accessToken }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

function findObjectFields(fields, path = '') {
  const objectFields = [];

  for (const [key, value] of Object.entries(fields)) {
    const fullPath = path ? `${path}.${key}` : key;

    if (value.mapValue) {
      const mapFields = value.mapValue.fields || {};

      // _id, name, username 구조인지 확인
      if (mapFields._id || mapFields.name || mapFields.username) {
        objectFields.push({
          path: fullPath,
          value: mapFields,
          hasIdNameUsername: true
        });
      } else {
        // 재귀적으로 하위 필드 검색
        objectFields.push(...findObjectFields(mapFields, fullPath));
      }
    }
  }

  return objectFields;
}

async function main() {
  console.log('=== Firestore 컬렉션에서 객체형 필드 검색 ===\n');

  const token = await getAccessToken();

  const collections = ['projects', 'execution_records', 'specbook_items', 'payment_requests'];

  for (const collectionName of collections) {
    console.log(`\n--- ${collectionName} 컬렉션 ---`);

    try {
      const result = await getCollection(token, collectionName);

      if (!result.documents || result.documents.length === 0) {
        console.log('  문서 없음');
        continue;
      }

      console.log(`  총 문서: ${result.documents.length}개`);

      let objectCount = 0;
      const objectFieldsFound = [];

      for (const doc of result.documents) {
        const docId = doc.name.split('/').pop();
        const fields = doc.fields || {};

        const objectFields = findObjectFields(fields);

        if (objectFields.length > 0) {
          objectCount++;
          for (const obj of objectFields) {
            if (obj.hasIdNameUsername) {
              objectFieldsFound.push({
                docId,
                field: obj.path,
                value: obj.value
              });
            }
          }
        }
      }

      if (objectFieldsFound.length > 0) {
        console.log(`  ⚠️  객체형 필드 발견: ${objectFieldsFound.length}개`);
        objectFieldsFound.slice(0, 5).forEach(item => {
          const name = item.value.name?.stringValue ||
                      item.value.username?.stringValue ||
                      '(알 수 없음)';
          console.log(`    - Doc ${item.docId}, 필드: ${item.field}, 이름: ${name}`);
        });
        if (objectFieldsFound.length > 5) {
          console.log(`    ... 외 ${objectFieldsFound.length - 5}개 더`);
        }
      } else {
        console.log('  ✅ 객체형 필드 없음');
      }
    } catch (error) {
      console.log('  에러:', error.message);
    }
  }

  console.log('\n=== 검색 완료 ===');
}

main().catch(console.error);
