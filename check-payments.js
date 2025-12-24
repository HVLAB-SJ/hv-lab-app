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
  return signatureInput + '.' + signature;
}

async function getAccessToken(jwt) {
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

async function getPayments(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/payments?pageSize=500',
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

async function main() {
  console.log('결제요청 데이터 확인...\n');

  const jwt = await getFirestoreToken();
  const accessToken = await getAccessToken(jwt);
  const result = await getPayments(accessToken);

  if (!result.documents) {
    console.log('결제요청 데이터 없음');
    return;
  }

  console.log('전체 결제요청 수:', result.documents.length);

  const statusCounts = {};
  result.documents.forEach(doc => {
    const status = doc.fields?.status?.stringValue || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('\n상태별 개수:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log('  -', status + ':', count);
  });

  // pending 상태 상세 확인
  const pendingDocs = result.documents.filter(doc => doc.fields?.status?.stringValue === 'pending');
  console.log('\n대기중(pending) 내역:', pendingDocs.length, '개');
  pendingDocs.slice(0, 5).forEach(doc => {
    const fields = doc.fields;
    const id = doc.name.split('/').pop();
    console.log('  ID:', id, '| 업체:', fields?.vendorName?.stringValue, '| 금액:', fields?.amount?.integerValue);
  });
}

main().catch(err => console.error('에러:', err.message));
