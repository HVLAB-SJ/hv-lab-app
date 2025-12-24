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

async function getFirestoreRecords(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/execution_records?pageSize=500',
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
  const token = await getAccessToken();
  const result = await getFirestoreRecords(token);

  if (!result.documents) {
    console.log('Firestore에 execution_records 없음');
    return;
  }

  console.log('Firestore 실행내역:', result.documents.length, '개');

  const authors = {};
  let withAuthor = 0;
  let withoutAuthor = 0;

  result.documents.forEach(doc => {
    const author = doc.fields?.author?.stringValue;
    if (author && author.trim()) {
      withAuthor++;
      authors[author] = (authors[author] || 0) + 1;
    } else {
      withoutAuthor++;
    }
  });

  console.log('작성자 있음:', withAuthor);
  console.log('작성자 없음:', withoutAuthor);
  console.log('\n작성자별 개수:');
  Object.entries(authors).sort((a, b) => b[1] - a[1]).forEach(([author, count]) => {
    console.log('  -', author + ':', count);
  });
}

main().catch(console.error);
