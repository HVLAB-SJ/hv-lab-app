/**
 * Firestore payment_requests 데이터 status 값 확인
 */

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

async function queryFirestore(accessToken, collection) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?pageSize=100`,
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

async function main() {
  console.log('Firestore 결제요청 데이터 조회 중...\n');
  const token = await getFirestoreToken();
  const result = await queryFirestore(token, 'payment_requests');

  if (result.documents) {
    console.log('총 문서 수:', result.documents.length);
    console.log('\n각 문서의 status 값:');
    result.documents.forEach((doc, i) => {
      const fields = doc.fields || {};
      let status = 'undefined';
      if (fields.status) {
        if (fields.status.stringValue !== undefined) {
          status = fields.status.stringValue;
        } else if (fields.status.nullValue !== undefined) {
          status = 'null';
        }
      }
      const amount = fields.amount ? fields.amount.integerValue : 'N/A';
      const projectName = fields.project_name ? fields.project_name.stringValue : 'N/A';
      const docId = doc.name.split('/').pop();
      console.log(`${i+1}. ID: ${docId}, status: "${status}", project: ${projectName}, amount: ${amount}`);
    });

    // status 값 통계
    const statusCounts = {};
    result.documents.forEach(doc => {
      const fields = doc.fields || {};
      let status = 'undefined';
      if (fields.status) {
        if (fields.status.stringValue !== undefined) {
          status = fields.status.stringValue || '(empty string)';
        } else if (fields.status.nullValue !== undefined) {
          status = 'null';
        }
      }
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('\n=== Status 통계 ===');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`${status}: ${count}개`);
    });
  } else {
    console.log('문서 없음 또는 에러:', result);
  }
}

main().catch(console.error);
