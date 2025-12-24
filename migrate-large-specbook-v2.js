/**
 * 대용량 스펙북 아이템 마이그레이션 V2
 * - 파일명|data: 형식의 파일 데이터도 처리
 * - DWG, PDF 등 비이미지 파일도 Storage로 업로드
 */

const https = require('https');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';
const PROJECT_ID = 'hv-lab-app';
const BUCKET = 'hv-lab-app-specbook-images';

// 아직 1MB 초과인 아이템 ID
const STILL_FAILED_IDS = [160, 157, 78, 84];

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

// 문자열이 업로드가 필요한 데이터인지 확인 (이미지, 파일 등)
function needsUpload(str) {
  if (typeof str !== 'string') return false;
  if (str.startsWith('http://') || str.startsWith('https://')) return false;  // 이미 URL
  if (str.length < 1000) return false;  // 너무 짧으면 URL이거나 텍스트

  // data:image, data:application 등으로 시작
  if (str.startsWith('data:')) return true;

  // 파일명|data: 형식
  if (str.includes('|data:')) return true;

  // 순수 base64 (긴 문자열이고 base64 패턴)
  if (/^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100))) return true;

  return false;
}

// 파일 확장자 추출
function getFileExtension(str) {
  // 파일명|data: 형식인 경우
  if (str.includes('|data:')) {
    const filename = str.split('|')[0];
    const ext = filename.split('.').pop().toLowerCase();
    return ext || 'bin';
  }

  // data:xxx/yyy 형식에서 확장자 추출
  const match = str.match(/data:([^;,]+)/);
  if (match) {
    const mimeType = match[1];
    const extensions = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/octet-stream': 'dwg',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xls',
    };
    return extensions[mimeType] || 'bin';
  }

  return 'bin';
}

// Content-Type 추출
function getContentType(str) {
  if (str.includes('|data:')) {
    const dataMatch = str.match(/\|data:([^;,]+)/);
    if (dataMatch) return dataMatch[1];
  }
  if (str.startsWith('data:')) {
    const match = str.match(/data:([^;,]+)/);
    if (match) return match[1];
  }
  return 'application/octet-stream';
}

// Base64 데이터 추출
function extractBase64(str) {
  // 파일명|data:xxx;base64,yyy 형식
  if (str.includes('|data:')) {
    const dataMatch = str.match(/\|data:[^;]+;base64,(.+)/);
    if (dataMatch) return dataMatch[1];
  }

  // data:xxx;base64,yyy 형식
  if (str.includes(',')) {
    return str.split(',')[1];
  }

  // 순수 base64
  return str;
}

async function uploadToStorage(accessToken, path, data) {
  return new Promise((resolve, reject) => {
    const pureBase64 = extractBase64(data);
    const buffer = Buffer.from(pureBase64, 'base64');
    const encodedPath = encodeURIComponent(path);
    const contentType = getContentType(data);

    console.log(`      업로드 중: ${path} (${(buffer.length / 1024).toFixed(0)}KB, ${contentType})`);

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
      headers: { 'Authorization': 'Bearer ' + accessToken }
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

async function processItem(accessToken, itemId) {
  console.log(`\n📦 처리 중: ID ${itemId}`);

  const detail = await getItemDetail(itemId);
  if (!detail) {
    throw new Error('아이템 상세 정보를 찾을 수 없음');
  }

  console.log(`  이름: ${detail.name}`);
  console.log(`  원본 크기: ${JSON.stringify(detail).length.toLocaleString()} bytes`);

  let uploadCount = 0;
  const processedItem = { ...detail };

  // image_url (main_image) 처리
  if (detail.image_url && needsUpload(detail.image_url)) {
    const ext = getFileExtension(detail.image_url);
    const path = `specbook_items/${itemId}/main.${ext}`;
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
      if (needsUpload(img)) {
        const ext = getFileExtension(img);
        const path = `specbook_items/${itemId}/sub_${i}.${ext}`;
        try {
          const url = await uploadToStorage(accessToken, path, img);
          newSubImages.push(url);
          uploadCount++;
          console.log(`  ✅ 서브 파일 ${i + 1} 업로드 완료`);
        } catch (e) {
          console.log(`  ⚠️ 서브 파일 ${i + 1} 업로드 실패: ${e.message}`);
          newSubImages.push(img);
        }
      } else {
        newSubImages.push(img);
        if (img.startsWith('http')) {
          console.log(`  ⏭️ 서브 파일 ${i + 1} - 이미 URL`);
        }
      }
    }
    processedItem.sub_images = newSubImages;
  }

  console.log(`  📤 총 ${uploadCount}개 파일을 Storage로 업로드`);

  // 문서 크기 확인
  const docSize = JSON.stringify(processedItem).length;
  console.log(`  📊 변환 후 문서 크기: ${docSize.toLocaleString()} bytes`);

  if (docSize > 1000000) {
    throw new Error(`문서 크기가 여전히 1MB를 초과합니다: ${docSize} bytes`);
  }

  // 기존 문서 삭제 후 재생성
  console.log(`  🗑️ 기존 문서 삭제 중...`);
  await deleteFirestoreDoc(accessToken, String(itemId));

  console.log(`  📝 새 문서 생성 중...`);
  await createFirestoreDoc(accessToken, String(itemId), processedItem);
  console.log(`  ✅ Firestore 저장 완료`);

  return uploadCount;
}

async function main() {
  console.log('🚀 대용량 스펙북 아이템 마이그레이션 V2 시작\n');
  console.log('대상 아이템 ID:', STILL_FAILED_IDS.join(', '), '\n');

  const accessToken = await getAccessToken();
  console.log('✅ 토큰 발급 완료');

  let success = 0;
  let failed = 0;
  let totalUploads = 0;

  for (const itemId of STILL_FAILED_IDS) {
    try {
      const uploadCount = await processItem(accessToken, itemId);
      totalUploads += uploadCount;
      success++;
    } catch (error) {
      console.log(`  ❌ 실패: ${error.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 완료!');
  console.log(`  성공: ${success}개`);
  console.log(`  실패: ${failed}개`);
  console.log(`  파일 업로드: ${totalUploads}개`);
}

main().catch(console.error);
