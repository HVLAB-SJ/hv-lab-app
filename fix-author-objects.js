/**
 * Firestore에서 author가 객체인 레코드를 찾아 문자열로 변환
 * React 오류 수정: Objects are not valid as a React child
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

async function updateAuthorField(accessToken, docId, authorString) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      fields: {
        author: { stringValue: authorString }
      }
    });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/execution_records/${docId}?updateMask.fieldPaths=author`,
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Firestore author 객체 → 문자열 변환 ===\n');

  const token = await getAccessToken();
  const result = await getFirestoreRecords(token);

  if (!result.documents) {
    console.log('execution_records 문서 없음');
    return;
  }

  console.log('전체 문서:', result.documents.length, '개\n');

  // author가 객체인 레코드 찾기
  const objectAuthors = [];
  const stringAuthors = [];

  result.documents.forEach(doc => {
    const docId = doc.name.split('/').pop();
    const authorField = doc.fields?.author;

    if (authorField?.mapValue) {
      // author가 객체인 경우
      const authorObj = authorField.mapValue.fields;
      const authorName = authorObj?.name?.stringValue ||
                         authorObj?.username?.stringValue ||
                         '';
      objectAuthors.push({
        docId,
        authorObj: authorField.mapValue.fields,
        authorName
      });
    } else if (authorField?.stringValue !== undefined) {
      stringAuthors.push(docId);
    }
  });

  console.log('author가 문자열인 레코드:', stringAuthors.length, '개');
  console.log('author가 객체인 레코드:', objectAuthors.length, '개\n');

  if (objectAuthors.length === 0) {
    console.log('수정할 레코드가 없습니다.');
    return;
  }

  // 객체 author 샘플 출력
  console.log('객체형 author 샘플:');
  objectAuthors.slice(0, 5).forEach(item => {
    console.log('  - ID:', item.docId);
    console.log('    객체:', JSON.stringify(item.authorObj));
    console.log('    추출된 이름:', item.authorName);
  });

  console.log('\n--- 수정 시작 ---\n');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < objectAuthors.length; i++) {
    const item = objectAuthors[i];
    try {
      await updateAuthorField(token, item.docId, item.authorName);
      success++;
      process.stdout.write(`\r[${i + 1}/${objectAuthors.length}] 성공: ${success}, 실패: ${failed}`);
    } catch (error) {
      failed++;
      console.log(`\n에러 (ID: ${item.docId}):`, error.message);
    }
    await sleep(50);
  }

  console.log('\n\n=== 결과 ===');
  console.log('성공:', success, '개');
  console.log('실패:', failed, '개');
  console.log('\nauthor 객체 → 문자열 변환 완료!');
}

main().catch(console.error);
