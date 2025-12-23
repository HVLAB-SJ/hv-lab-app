/**
 * 스펙북 이미지를 Firebase Storage로 마이그레이션
 * Railway에서 이미지(base64)를 가져와 Firebase Storage에 업로드하고 URL을 Firestore에 저장
 */

const https = require('https');
const crypto = require('crypto');

const PROJECT_ID = 'hv-lab-app';
const BUCKET_NAME = 'hv-lab-app-specbook-images';
const serviceAccount = require('./serviceAccountKey.json');
const RAILWAY_API = 'api.hvlab.app';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken(scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: scope,
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
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.access_token) {
          resolve(parsed.access_token);
        } else {
          reject(new Error(data));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fetchFromRailway(endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: RAILWAY_API,
      path: `/api${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON: ' + body.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchItemDetail(itemId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: RAILWAY_API,
      path: `/api/specbook/item/${itemId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function uploadToStorage(storageToken, filePath, base64Data) {
  return new Promise((resolve, reject) => {
    // base64 데이터에서 실제 데이터 추출
    let imageData = base64Data;
    let contentType = 'image/jpeg';

    if (base64Data.startsWith('data:')) {
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        contentType = matches[1];
        imageData = matches[2];
      }
    }

    const buffer = Buffer.from(imageData, 'base64');
    const encodedPath = encodeURIComponent(filePath);

    const req = https.request({
      hostname: 'storage.googleapis.com',
      path: `/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=${encodedPath}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${storageToken}`,
        'Content-Type': contentType,
        'Content-Length': buffer.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(`https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`);
        } else {
          reject(new Error(`Storage upload failed: ${res.statusCode} - ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

async function makePublic(storageToken, filePath) {
  return new Promise((resolve, reject) => {
    const encodedPath = encodeURIComponent(filePath);
    const body = JSON.stringify({
      entity: 'allUsers',
      role: 'READER'
    });

    const req = https.request({
      hostname: 'storage.googleapis.com',
      path: `/storage/v1/b/${BUCKET_NAME}/o/${encodedPath}/acl`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${storageToken}`,
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
          // 이미 public인 경우 에러 무시
          resolve(true);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function updateFirestore(firestoreToken, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        fields[key] = { stringValue: value };
      } else if (Array.isArray(value)) {
        fields[key] = {
          arrayValue: {
            values: value.map(v => ({ stringValue: v }))
          }
        };
      }
    }

    const updateMask = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&');
    const body = JSON.stringify({ fields });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/specbook_items/${docId}?${updateMask}`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${firestoreToken}`,
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
          reject(new Error(`Firestore update failed: ${res.statusCode} - ${data}`));
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
  console.log('🚀 스펙북 이미지 Firebase Storage 마이그레이션 시작\n');

  try {
    // 토큰 발급
    console.log('🔑 토큰 발급 중...');
    const storageToken = await getAccessToken('https://www.googleapis.com/auth/devstorage.full_control');
    const firestoreToken = await getAccessToken('https://www.googleapis.com/auth/datastore');
    console.log('✅ 토큰 발급 완료\n');

    // Railway에서 스펙북 아이템 목록 가져오기
    console.log('📥 Railway에서 스펙북 데이터 가져오는 중...');
    const items = await fetchFromRailway('/specbook/library/meta');
    console.log(`  총 ${items.length}개 아이템\n`);

    let successMain = 0;
    let successSub = 0;
    let failedMain = 0;
    let failedSub = 0;
    let skippedMain = 0;
    let skippedSub = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = String(item.id);

      process.stdout.write(`\r[${i + 1}/${items.length}] ${item.name || itemId} 처리 중...                    `);

      // 개별 아이템 상세 정보 가져오기 (sub_images 포함)
      let itemDetail;
      try {
        itemDetail = await fetchItemDetail(itemId);
      } catch (e) {
        console.log(`\n  ⚠️ 상세 정보 가져오기 실패: ${e.message}`);
        continue;
      }

      const updateData = {};

      // 메인 이미지 처리 (main_image 또는 image_url)
      const mainImage = itemDetail.main_image || itemDetail.image_url;
      if (mainImage && mainImage.startsWith('data:')) {
        try {
          const mainPath = `specbook/${itemId}/main.jpg`;
          await uploadToStorage(storageToken, mainPath, mainImage);
          await makePublic(storageToken, mainPath);
          updateData.main_image_url = `https://storage.googleapis.com/${BUCKET_NAME}/${mainPath}`;
          successMain++;
        } catch (e) {
          failedMain++;
          console.log(`\n  ⚠️ 메인 이미지 업로드 실패: ${e.message}`);
        }
      } else {
        skippedMain++;
      }

      // 서브 이미지 처리
      if (itemDetail.sub_images && Array.isArray(itemDetail.sub_images) && itemDetail.sub_images.length > 0) {
        const subUrls = [];
        for (let j = 0; j < itemDetail.sub_images.length; j++) {
          const subImage = itemDetail.sub_images[j];
          if (subImage && subImage.startsWith('data:')) {
            try {
              const subPath = `specbook/${itemId}/sub_${j}.jpg`;
              await uploadToStorage(storageToken, subPath, subImage);
              await makePublic(storageToken, subPath);
              subUrls.push(`https://storage.googleapis.com/${BUCKET_NAME}/${subPath}`);
            } catch (e) {
              // 개별 서브 이미지 실패는 로그 출력
              console.log(`\n  ⚠️ 서브 이미지 ${j} 업로드 실패`);
            }
          }
        }
        if (subUrls.length > 0) {
          updateData.sub_image_urls = subUrls;
          successSub++;
        } else {
          skippedSub++;
        }
      } else {
        skippedSub++;
      }

      // Firestore 업데이트
      if (Object.keys(updateData).length > 0) {
        try {
          await updateFirestore(firestoreToken, itemId, updateData);
        } catch (e) {
          console.log(`\n  ⚠️ Firestore 업데이트 실패: ${e.message}`);
        }
      }

      // API 호출 속도 제한
      await sleep(200);
    }

    console.log('\n\n📊 결과 요약:');
    console.log(`  메인 이미지: 성공 ${successMain}, 실패 ${failedMain}, 스킵 ${skippedMain}`);
    console.log(`  서브 이미지: 성공 ${successSub}, 실패 ${failedSub}, 스킵 ${skippedSub}`);
    console.log('\n🎉 마이그레이션 완료!');

  } catch (error) {
    console.error('\n❌ 오류:', error.message);
  }
}

main();
