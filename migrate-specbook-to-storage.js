/**
 * 스펙북 아이템의 base64 이미지를 Firebase Storage로 마이그레이션
 * - image_url (main_image)과 sub_images의 base64 데이터를 Storage로 업로드
 * - Firestore 문서를 Storage URL로 업데이트
 */

const https = require('https');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';
const PROJECT_ID = 'hv-lab-app';
const BUCKET = 'hv-lab-app-specbook-images';

// 실패한 스펙북 아이템 이름
const FAILED_ITEMS = [
  '704NI', '781NI', '스탠리', 'NEOREST NX', '브리오 원피스', '웨이브 R 투피스',
  '블로이(비데무광+도기유광)', 'PLAT 비데일체형(직수형)', '웨이브 S 투피스',
  '코인 1075', 'SP01 (메탈호스)', 'EU830 엠보(+스텐배수구)', 'AT830(+스텐배수구)',
  '아쿠노 셀렉트', '443.12AS(직수만됨)', '매립욕조 브릭(800~900x1600)',
  '매립욕조 라인(750x1400~1800)', '트림리스 정사각 발목등', '모노플러스 8000'
];

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };

  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/devstorage.read_write',
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

async function getItemList() {
  return new Promise((resolve, reject) => {
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
}

async function getItemDetail(itemId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api/specbook/item/' + itemId,
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
}

function isBase64Image(str) {
  if (typeof str !== 'string') return false;
  // data:image로 시작하거나, 긴 base64 문자열인 경우
  return str.startsWith('data:image') ||
         (str.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)));
}

function getContentType(base64Data) {
  if (base64Data.startsWith('data:')) {
    const match = base64Data.match(/data:([^;]+);/);
    if (match) return match[1];
  }
  return 'image/jpeg';
}

async function uploadToStorage(accessToken, path, base64Data) {
  return new Promise((resolve, reject) => {
    let pureBase64 = base64Data;
    if (base64Data.includes(',')) {
      pureBase64 = base64Data.split(',')[1];
    }

    const buffer = Buffer.from(pureBase64, 'base64');
    const encodedPath = encodeURIComponent(path);
    const contentType = getContentType(base64Data);

    const req = https.request({
      hostname: 'storage.googleapis.com',
      path: `/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodedPath}`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': contentType,
        'Content-Length': buffer.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const publicUrl = `https://storage.googleapis.com/${BUCKET}/${path}`;
          resolve(publicUrl);
        } else {
          reject(new Error('Storage upload failed: ' + res.statusCode));
        }
      });
    });
    req.on('error', reject);
    req.write(buffer);
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

async function deleteFirestoreDoc(accessToken, docId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/specbook_items/${docId}`,
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300 || res.statusCode === 404) {
          resolve(true);
        } else {
          reject(new Error('Delete failed: ' + res.statusCode));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function createFirestoreDoc(accessToken, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== '_id' && key !== 'id') {
        fields[key] = convertToFirestoreValue(value);
      }
    }
    // id 필드는 명시적으로 추가
    fields['id'] = { integerValue: String(docId) };

    const body = JSON.stringify({ fields });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/specbook_items?documentId=${docId}`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
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
          reject(new Error('Create failed: ' + res.statusCode + ' ' + data.substring(0, 300)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function processItem(accessToken, item) {
  console.log(`\n📦 처리 중: ${item.name} (ID: ${item.id})`);

  const detail = await getItemDetail(item.id);
  if (!detail) {
    throw new Error('아이템 상세 정보를 찾을 수 없음');
  }

  let uploadCount = 0;
  const processedItem = { ...detail };

  // image_url (main_image) 처리
  if (detail.image_url && isBase64Image(detail.image_url)) {
    const path = `specbook_items/${item.id}/main.jpg`;
    try {
      processedItem.image_url = await uploadToStorage(accessToken, path, detail.image_url);
      uploadCount++;
      console.log(`  ✅ 메인 이미지 업로드 완료`);
    } catch (e) {
      console.log(`  ⚠️ 메인 이미지 업로드 실패: ${e.message}`);
    }
  }

  // sub_images 처리
  if (Array.isArray(detail.sub_images) && detail.sub_images.length > 0) {
    const newSubImages = [];
    for (let i = 0; i < detail.sub_images.length; i++) {
      const img = detail.sub_images[i];
      if (isBase64Image(img)) {
        const path = `specbook_items/${item.id}/sub_${i}.jpg`;
        try {
          const url = await uploadToStorage(accessToken, path, img);
          newSubImages.push(url);
          uploadCount++;
          console.log(`  ✅ 서브 이미지 ${i + 1} 업로드 완료`);
        } catch (e) {
          console.log(`  ⚠️ 서브 이미지 ${i + 1} 업로드 실패: ${e.message}`);
          newSubImages.push(img); // 실패시 원본 유지
        }
      } else {
        newSubImages.push(img); // URL은 그대로
      }
    }
    processedItem.sub_images = newSubImages;
  }

  console.log(`  📤 총 ${uploadCount}개 이미지를 Storage로 업로드`);

  // 문서 크기 확인
  const docSize = JSON.stringify(processedItem).length;
  console.log(`  📊 문서 크기: ${docSize.toLocaleString()} bytes`);

  if (docSize > 1000000) {
    throw new Error(`문서 크기가 여전히 1MB를 초과합니다: ${docSize} bytes`);
  }

  // 기존 문서 삭제 후 재생성
  console.log(`  🗑️ 기존 문서 삭제 중...`);
  await deleteFirestoreDoc(accessToken, String(item.id));

  console.log(`  📝 새 문서 생성 중...`);
  await createFirestoreDoc(accessToken, String(item.id), processedItem);
  console.log(`  ✅ Firestore 저장 완료`);

  return uploadCount;
}

async function main() {
  console.log('🚀 스펙북 이미지 Firebase Storage 마이그레이션 시작\n');
  console.log('대상 아이템:', FAILED_ITEMS.length, '개\n');

  const accessToken = await getAccessToken();
  console.log('✅ 토큰 발급 완료');

  // 전체 아이템 목록 조회
  const allItems = await getItemList();
  console.log(`📋 전체 아이템: ${allItems.length}개`);

  // 실패한 아이템 필터링
  const targetItems = allItems.filter(item => FAILED_ITEMS.includes(item.name));
  console.log(`🎯 대상 아이템: ${targetItems.length}개\n`);

  let success = 0;
  let failed = 0;
  let totalUploads = 0;

  for (const item of targetItems) {
    try {
      const uploadCount = await processItem(accessToken, item);
      totalUploads += uploadCount;
      success++;
    } catch (error) {
      console.log(`  ❌ 실패: ${error.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 1000)); // 속도 조절
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 완료!');
  console.log(`  성공: ${success}개`);
  console.log(`  실패: ${failed}개`);
  console.log(`  이미지 업로드: ${totalUploads}개`);
}

main().catch(console.error);
