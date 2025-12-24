/**
 * 프로젝트 데이터를 Railway SQLite에서 Firestore로 마이그레이션
 */
const https = require('https');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';
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

async function getProjectsFromRailway() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api/projects',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
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
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      return { arrayValue: { values: [] } };
    }
    return {
      arrayValue: {
        values: value.map(v => convertToFirestoreValue(v))
      }
    };
  } else if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = convertToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

// Railway 데이터를 Firestore 형식으로 변환
function transformProjectData(railwayProject) {
  return {
    id: railwayProject.id,
    name: railwayProject.name || '',
    client: railwayProject.client || '',
    address: railwayProject.address || '',
    startDate: railwayProject.start_date || railwayProject.startDate || null,
    endDate: railwayProject.end_date || railwayProject.endDate || null,
    status: railwayProject.status || 'planning',
    color: railwayProject.color || '#4A90E2',
    managerId: railwayProject.manager_id || null,
    manager: railwayProject.manager || '',
    managerName: railwayProject.manager_name || '',
    managerUsername: railwayProject.manager_username || '',
    description: railwayProject.description || '',
    meetingNotes: railwayProject.meetingNotes || [],
    customerRequests: railwayProject.customerRequests || [],
    entrancePassword: railwayProject.entrancePassword || '',
    sitePassword: railwayProject.sitePassword || '',
    createdAt: railwayProject.created_at || railwayProject.createdAt || new Date().toISOString(),
    updatedAt: railwayProject.updated_at || railwayProject.updatedAt || new Date().toISOString()
  };
}

async function createFirestoreDoc(accessToken, collection, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = convertToFirestoreValue(value);
    }

    const body = JSON.stringify({ fields });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${docId}`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else if (res.statusCode === 409) {
          // 이미 존재하는 경우 업데이트로 전환
          resolve('exists');
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function updateFirestoreDoc(accessToken, collection, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const updateMaskPaths = [];

    for (const [key, value] of Object.entries(data)) {
      fields[key] = convertToFirestoreValue(value);
      updateMaskPaths.push(key);
    }

    const body = JSON.stringify({ fields });
    const updateMask = updateMaskPaths.map(p => `updateMask.fieldPaths=${p}`).join('&');

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?${updateMask}`,
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🔄 프로젝트 마이그레이션 시작\n');

  // 1. Firestore 토큰 발급
  const firestoreToken = await getFirestoreToken();
  console.log('✅ Firestore 토큰 발급 완료\n');

  // 2. Railway에서 프로젝트 목록 가져오기
  const projects = await getProjectsFromRailway();
  console.log(`📦 Railway에서 ${projects.length}개 프로젝트 조회\n`);

  // 3. Firestore에 프로젝트 저장
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const project of projects) {
    try {
      const firestoreData = transformProjectData(project);
      const docId = String(project.id);

      const result = await createFirestoreDoc(firestoreToken, 'projects', docId, firestoreData);

      if (result === 'exists') {
        // 이미 존재하면 업데이트
        await updateFirestoreDoc(firestoreToken, 'projects', docId, firestoreData);
        updated++;
        console.log(`  🔄 ${project.name} (업데이트)`);
      } else {
        created++;
        console.log(`  ✅ ${project.name} (생성)`);
      }
    } catch (error) {
      failed++;
      console.log(`  ❌ ${project.name}: ${error.message}`);
    }

    // 속도 조절
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n🎉 프로젝트 마이그레이션 완료!');
  console.log(`  - 생성: ${created}`);
  console.log(`  - 업데이트: ${updated}`);
  console.log(`  - 실패: ${failed}`);
}

main().catch(console.error);
