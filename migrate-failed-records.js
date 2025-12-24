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

async function getTokens() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };

  // Firestore + Storage scope
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

async function uploadToStorage(accessToken, path, base64Data, contentType) {
  return new Promise((resolve, reject) => {
    // base64 데이터에서 prefix 제거
    let pureBase64 = base64Data;
    if (base64Data.includes(',')) {
      pureBase64 = base64Data.split(',')[1];
    }

    const buffer = Buffer.from(pureBase64, 'base64');
    const encodedPath = encodeURIComponent(path);

    const req = https.request({
      hostname: 'storage.googleapis.com',
      path: `/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodedPath}`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': contentType || 'image/jpeg',
        'Content-Length': buffer.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const result = JSON.parse(data);
          // 공개 URL 생성
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

function getContentType(base64Data) {
  if (base64Data.startsWith('data:')) {
    const match = base64Data.match(/data:([^;]+);/);
    if (match) return match[1];
  }
  return 'image/jpeg';
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
          reject(new Error('Firestore create failed: ' + res.statusCode + ' ' + data.substring(0, 300)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function isBase64Image(str) {
  if (typeof str !== 'string') return false;
  return str.startsWith('data:image') ||
         (str.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)));
}

async function processRecord(accessToken, recordId) {
  console.log(`\n📦 처리 중: execution_record ${recordId}`);

  // Railway에서 데이터 가져오기
  const record = await getRecordFromRailway(recordId);
  if (!record) {
    throw new Error('레코드를 찾을 수 없음');
  }

  console.log(`  프로젝트: ${record.project_name || 'N/A'}`);

  // 이미지 필드 찾기 및 Storage로 업로드
  let imageCount = 0;
  const processedRecord = { ...record };

  // images 배열 처리
  if (Array.isArray(record.images) && record.images.length > 0) {
    const newImages = [];
    for (let i = 0; i < record.images.length; i++) {
      const img = record.images[i];
      if (isBase64Image(img)) {
        const path = `execution_records/${recordId}/image_${i}.jpg`;
        try {
          const url = await uploadToStorage(accessToken, path, img, getContentType(img));
          newImages.push(url);
          imageCount++;
          console.log(`    ✅ 이미지 ${i + 1} 업로드 완료`);
        } catch (e) {
          console.log(`    ❌ 이미지 ${i + 1} 업로드 실패: ${e.message}`);
          newImages.push(img); // 실패시 원본 유지
        }
      } else {
        newImages.push(img); // URL은 그대로 유지
      }
    }
    processedRecord.images = newImages;
  }

  // receipts 배열 처리 (영수증 이미지)
  if (Array.isArray(record.receipts) && record.receipts.length > 0) {
    const newReceipts = [];
    for (let i = 0; i < record.receipts.length; i++) {
      const receipt = record.receipts[i];
      if (typeof receipt === 'object' && receipt.image && isBase64Image(receipt.image)) {
        const path = `execution_records/${recordId}/receipt_${i}.jpg`;
        try {
          const url = await uploadToStorage(accessToken, path, receipt.image, getContentType(receipt.image));
          newReceipts.push({ ...receipt, image: url });
          imageCount++;
          console.log(`    ✅ 영수증 ${i + 1} 업로드 완료`);
        } catch (e) {
          console.log(`    ❌ 영수증 ${i + 1} 업로드 실패: ${e.message}`);
          newReceipts.push(receipt);
        }
      } else if (typeof receipt === 'string' && isBase64Image(receipt)) {
        const path = `execution_records/${recordId}/receipt_${i}.jpg`;
        try {
          const url = await uploadToStorage(accessToken, path, receipt, getContentType(receipt));
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
        if (item.image && isBase64Image(item.image)) {
          const path = `execution_records/${recordId}/item_${i}.jpg`;
          try {
            newItem.image = await uploadToStorage(accessToken, path, item.image, getContentType(item.image));
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
            if (isBase64Image(img)) {
              const path = `execution_records/${recordId}/item_${i}_img_${j}.jpg`;
              try {
                const url = await uploadToStorage(accessToken, path, img, getContentType(img));
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

  console.log(`  총 ${imageCount}개 이미지를 Storage로 이전`);

  // Firestore에 저장
  await createFirestoreDoc(accessToken, String(recordId), processedRecord);
  console.log(`  ✅ Firestore 저장 완료`);

  return imageCount;
}

async function main() {
  console.log('🚀 실패한 execution_records 마이그레이션 시작\n');
  console.log('대상 ID:', FAILED_IDS.join(', '));

  const accessToken = await getTokens();
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

    // 속도 조절
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 완료!');
  console.log(`  성공: ${success}개`);
  console.log(`  실패: ${failed}개`);
  console.log(`  이미지 이전: ${totalImages}개`);
}

main().catch(console.error);
