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

async function getProjects(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/projects?pageSize=100',
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

async function getSpecbookItems(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/specbook_items?pageSize=500',
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
  console.log('Firestore 데이터 확인...\n');

  const jwt = await getFirestoreToken();
  const accessToken = await getAccessToken(jwt);

  // 프로젝트 확인
  const projects = await getProjects(accessToken);
  console.log('=== 프로젝트 ===');
  if (!projects.documents) {
    console.log('프로젝트 데이터 없음');
  } else {
    console.log('전체 프로젝트 수:', projects.documents.length);
  }

  // 스펙북 아이템 확인
  console.log('\n=== 스펙북 아이템 ===');
  const items = await getSpecbookItems(accessToken);
  if (!items.documents) {
    console.log('스펙북 아이템 없음');
    return;
  }
  console.log('전체 아이템 수:', items.documents.length);

  // project_id별 아이템 수
  const projectItemCounts = {};
  items.documents.forEach(doc => {
    const fields = doc.fields;
    const projectId = fields?.project_id?.integerValue || fields?.project_id?.stringValue || 'null';
    projectItemCounts[projectId] = (projectItemCounts[projectId] || 0) + 1;
  });

  console.log('\nproject_id별 아이템 수:');
  Object.entries(projectItemCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([pid, count]) => {
    console.log('  project_id:', pid, '-', count, '개');
  });
}

main().catch(err => console.error('에러:', err.message));
