/**
 * Firestore 문서 상세 확인
 */
const https = require('https');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

const PROJECT_ID = 'hv-lab-app';

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getFirestoreToken() {
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

async function getFirestoreDoc(accessToken, docId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/specbook_items/' + docId,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + accessToken }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(data.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== Firestore 문서 상세 확인 ===\n');

  const token = await getFirestoreToken();
  console.log('토큰 발급 완료\n');

  // ID 147 (704NI) 확인
  const doc = await getFirestoreDoc(token, '147');

  if (doc.error) {
    console.log('Error:', doc.error.message);
    return;
  }

  const fields = doc.fields || {};
  console.log('문서 ID: 147');
  console.log('name:', fields.name?.stringValue);
  console.log('image_url 존재:', !!fields.image_url?.stringValue);
  console.log('main_image_url 존재:', !!fields.main_image_url?.stringValue);
  console.log('sub_images 존재:', !!fields.sub_images?.arrayValue);
  console.log('sub_image_urls 존재:', !!fields.sub_image_urls?.arrayValue);

  if (fields.sub_image_urls?.arrayValue?.values) {
    console.log('sub_image_urls 개수:', fields.sub_image_urls.arrayValue.values.length);
    fields.sub_image_urls.arrayValue.values.forEach((v, i) => {
      const url = v.stringValue;
      console.log('  [' + i + ']:', url.substring(0, 100) + '...');
    });
  }

  if (fields.sub_images?.arrayValue?.values) {
    console.log('sub_images 개수:', fields.sub_images.arrayValue.values.length);
  }

  // 필드 목록 출력
  console.log('\n모든 필드:');
  Object.keys(fields).forEach(key => {
    const type = Object.keys(fields[key])[0];
    console.log('  -', key, '(' + type + ')');
  });
}

main().catch(console.error);
