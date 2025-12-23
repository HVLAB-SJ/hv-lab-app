/**
 * Firebase API 테스트 - 스펙북 아이템 조회
 */
const https = require('https');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';

// Firebase API에서 스펙북 아이템 조회
function testFirebaseAPI(itemId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'asia-northeast3-hv-lab-app.cloudfunctions.net',
      path: '/api/specbook/item/' + itemId,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data.substring(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Railway API에서 스펙북 아이템 조회
function testRailwayAPI(itemId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api/specbook/item/' + itemId,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data.substring(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== Firebase vs Railway API 비교 테스트 ===\n');

  // 테스트할 아이템 ID들 (실제 존재하는 ID)
  const testIds = [149, 147, 146];

  for (const id of testIds) {
    console.log('--- 아이템 ID:', id, '---');

    // Railway API 테스트
    const railwayResult = await testRailwayAPI(id);
    console.log('Railway:');
    console.log('  Status:', railwayResult.status);
    console.log('  Name:', railwayResult.data.name || 'N/A');
    console.log('  Image URL exists:', !!railwayResult.data.image_url);
    console.log('  Sub images:', railwayResult.data.sub_images?.length || 0, '개');

    // Firebase API 테스트
    const firebaseResult = await testFirebaseAPI(id);
    console.log('Firebase:');
    console.log('  Status:', firebaseResult.status);
    console.log('  Name:', firebaseResult.data.name || 'N/A');
    console.log('  Image URL exists:', !!firebaseResult.data.image_url);
    console.log('  Sub images:', firebaseResult.data.sub_images?.length || 0, '개');

    console.log('');
  }

  // 라이브러리 메타 테스트
  console.log('--- 라이브러리 메타 (목록) ---');

  const railwayMeta = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api/specbook/library/meta',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });

  const firebaseMeta = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'asia-northeast3-hv-lab-app.cloudfunctions.net',
      path: '/api/specbook/library/meta',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });

  console.log('Railway 아이템 수:', railwayMeta.length);
  console.log('Firebase 아이템 수:', firebaseMeta.length);
}

main().catch(console.error);
