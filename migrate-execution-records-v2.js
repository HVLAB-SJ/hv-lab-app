/**
 * 실패한 execution_records를 Firebase Storage로 이미지 분리 후 Firestore에 저장
 * 실패한 ID: 158, 76, 54, 52, 16, 13
 */

const https = require('https');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';
const PROJECT_ID = 'hv-lab-app';
const BUCKET = 'hv-lab-app.firebasestorage.app';

// 실패한 레코드 ID
const FAILED_IDS = [158, 76, 54, 52, 16, 13];

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

async function getRecordFromRailway(recordId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api/execution/' + recordId,
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

// 문자열이 업로드가 필요한 데이터인지 확인
function needsUpload(str) {
  if (typeof str !== 'string') return false;
  if (str.startsWith('http://') || str.startsWith('https://')) return false;
  if (str.length < 1000) return false;
  if (str.startsWith('data:')) return true;
  if (str.includes('|data:')) return true;
  if (/^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100))) return true;
  return false;
}

function getContentType(str) {
  if (str.includes('|data:')) {
    const dataMatch = str.match(/\|data:([^;,]+)/);
    if (dataMatch) return dataMatch[1];
  }
  if (str.startsWith('data:')) {
    const match = str.match(/data:([^;,]+)/);
    if (match) return match[1];
  }
  return 'image/jpeg';
}

function extractBase64(str) {
  if (str.includes('|data:')) {
    const dataMatch = str.match(/\|data:[^;]+;base64,(.+)/);
    if (dataMatch) return dataMatch[1];
  }
  if (str.includes(',')) {
    return str.split(',')[1];
  }
  return str;
}

async function uploadToStorage(accessToken, path, data) {
  return new Promise((resolve, reject) => {
    const pureBase64 = extractBase64(data);
    const buffer = Buffer.from(pureBase64, 'base64');
    const encodedPath = encodeURIComponent(path);
    const contentType = getContentType(data);

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
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media`;
          resolve(publicUrl);
        } else {
          reject(new Error('Storage upload failed: ' + res.statusCode + ' ' + data.substring(0, 200)));
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
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/execution_records/${docId}`,
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
      if (key !== '_id') {
        fields[key] = convertToFirestoreValue(value);
      }
    }

    const body = JSON.stringify({ fields });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/execution_records?documentId=${docId}`,
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

async function processRecord(accessToken, recordId) {
  console.log(`\n📦 처리 중: execution_record ${recordId}`);

  const record = await getRecordFromRailway(recordId);
  if (!record) {
    throw new Error('레코드를 찾을 수 없음');
  }

  console.log(`  프로젝트: ${record.project_name || 'N/A'}`);
  console.log(`  원본 크기: ${JSON.stringify(record).length.toLocaleString()} bytes`);

  let imageCount = 0;
  const processedRecord = { ...record };

  // images 배열 처리
  if (Array.isArray(record.images) && record.images.length > 0) {
    const newImages = [];
    for (let i = 0; i < record.images.length; i++) {
      const img = record.images[i];
      if (needsUpload(img)) {
        const path = `execution_records/${recordId}/image_${i}.jpg`;
        try {
          const url = await uploadToStorage(accessToken, path, img);
          newImages.push(url);
          imageCount++;
          console.log(`    ✅ 이미지 ${i + 1} 업로드 완료`);
        } catch (e) {
          console.log(`    ❌ 이미지 ${i + 1} 업로드 실패: ${e.message}`);
          newImages.push(img);
        }
      } else {
        newImages.push(img);
      }
    }
    processedRecord.images = newImages;
  }

  // receipts 배열 처리 (영수증 이미지)
  if (Array.isArray(record.receipts) && record.receipts.length > 0) {
    const newReceipts = [];
    for (let i = 0; i < record.receipts.length; i++) {
      const receipt = record.receipts[i];
      if (typeof receipt === 'object' && receipt.image && needsUpload(receipt.image)) {
        const path = `execution_records/${recordId}/receipt_${i}.jpg`;
        try {
          const url = await uploadToStorage(accessToken, path, receipt.image);
          newReceipts.push({ ...receipt, image: url });
          imageCount++;
          console.log(`    ✅ 영수증 ${i + 1} 업로드 완료`);
        } catch (e) {
          console.log(`    ❌ 영수증 ${i + 1} 업로드 실패: ${e.message}`);
          newReceipts.push(receipt);
        }
      } else if (typeof receipt === 'string' && needsUpload(receipt)) {
        const path = `execution_records/${recordId}/receipt_${i}.jpg`;
        try {
          const url = await uploadToStorage(accessToken, path, receipt);
          newReceipts.push(url);
          imageCount++;
          console.log(`    ✅ 영수증 ${i + 1} 업로드 완료`);
        } catch (e) {
          console.log(`    ❌ 영수증 ${i + 1} 업로드 실패: ${e.message}`);
          newReceipts.push(receipt);
        }
      } else {
        newReceipts.push(receipt);
      }
    }
    processedRecord.receipts = newReceipts;
  }

  // items 내부의 이미지 처리
  if (Array.isArray(record.items)) {
    const newItems = [];
    for (let i = 0; i < record.items.length; i++) {
      const item = record.items[i];
      if (typeof item === 'object') {
        const newItem = { ...item };

        // item.image 처리
        if (item.image && needsUpload(item.image)) {
          const path = `execution_records/${recordId}/item_${i}.jpg`;
          try {
            newItem.image = await uploadToStorage(accessToken, path, item.image);
            imageCount++;
            console.log(`    ✅ 아이템 이미지 ${i + 1} 업로드 완료`);
          } catch (e) {
            console.log(`    ❌ 아이템 이미지 ${i + 1} 업로드 실패: ${e.message}`);
          }
        }

        // item.images 배열 처리
        if (Array.isArray(item.images)) {
          const newItemImages = [];
          for (let j = 0; j < item.images.length; j++) {
            const img = item.images[j];
            if (needsUpload(img)) {
              const path = `execution_records/${recordId}/item_${i}_img_${j}.jpg`;
              try {
                const url = await uploadToStorage(accessToken, path, img);
                newItemImages.push(url);
                imageCount++;
              } catch (e) {
                newItemImages.push(img);
              }
            } else {
              newItemImages.push(img);
            }
          }
          newItem.images = newItemImages;
        }

        newItems.push(newItem);
      } else {
        newItems.push(item);
      }
    }
    processedRecord.items = newItems;
  }

  console.log(`  📤 총 ${imageCount}개 이미지를 Storage로 이전`);

  // 문서 크기 확인
  const docSize = JSON.stringify(processedRecord).length;
  console.log(`  📊 변환 후 문서 크기: ${docSize.toLocaleString()} bytes`);

  if (docSize > 1000000) {
    throw new Error(`문서 크기가 여전히 1MB를 초과합니다: ${docSize} bytes`);
  }

  // 기존 문서 삭제 후 재생성
  console.log(`  🗑️ 기존 문서 삭제 중...`);
  await deleteFirestoreDoc(accessToken, String(recordId));

  console.log(`  📝 새 문서 생성 중...`);
  await createFirestoreDoc(accessToken, String(recordId), processedRecord);
  console.log(`  ✅ Firestore 저장 완료`);

  return imageCount;
}

async function main() {
  console.log('🚀 실패한 execution_records 마이그레이션 시작\n');
  console.log('대상 ID:', FAILED_IDS.join(', '));

  const accessToken = await getAccessToken();
  console.log('✅ 토큰 발급 완료\n');

  let success = 0;
  let failed = 0;
  let totalImages = 0;

  for (const id of FAILED_IDS) {
    try {
      const imgCount = await processRecord(accessToken, id);
      totalImages += imgCount;
      success++;
    } catch (error) {
      console.log(`  ❌ 실패: ${error.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 완료!');
  console.log(`  성공: ${success}개`);
  console.log(`  실패: ${failed}개`);
  console.log(`  이미지 이전: ${totalImages}개`);
}

main().catch(console.error);
