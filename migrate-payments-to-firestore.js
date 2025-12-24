/**
 * 결제요청 데이터를 Railway SQLite에서 Firestore로 마이그레이션
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

async function getPaymentsFromRailway() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api/payments',
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
function transformPaymentData(railwayPayment) {
  // 이미지 처리 - base64 이미지는 별도로 저장하거나 URL로 대체해야 함
  let images = [];
  if (railwayPayment.images) {
    if (typeof railwayPayment.images === 'string') {
      try {
        images = JSON.parse(railwayPayment.images);
      } catch (e) {
        // base64 이미지가 너무 클 경우 빈 배열로 처리 (추후 Storage 마이그레이션 필요)
        images = [];
      }
    } else if (Array.isArray(railwayPayment.images)) {
      images = railwayPayment.images;
    }
  }

  // base64 이미지가 너무 크면 Firestore 문서 크기 제한(1MB)을 초과할 수 있으므로
  // 이미지 개수만 기록하고 실제 이미지는 제외
  const hasLargeImages = images.some(img => img && img.length > 100000);

  return {
    id: railwayPayment.id,
    projectId: railwayPayment.project_id,
    userId: railwayPayment.user_id,
    requestType: railwayPayment.request_type || 'material',
    vendorName: railwayPayment.vendor_name || '',
    description: railwayPayment.description || '',
    amount: railwayPayment.amount || 0,
    accountHolder: railwayPayment.account_holder || '',
    bankName: railwayPayment.bank_name || '',
    accountNumber: railwayPayment.account_number || '',
    status: railwayPayment.status || 'pending',
    approvedBy: railwayPayment.approved_by,
    paidAt: railwayPayment.paid_at,
    receiptUrl: railwayPayment.receipt_url,
    notes: railwayPayment.notes || '',
    createdAt: railwayPayment.created_at,
    updatedAt: railwayPayment.updated_at,
    applyTaxDeduction: railwayPayment.apply_tax_deduction === 1,
    materialAmount: railwayPayment.material_amount || 0,
    laborAmount: railwayPayment.labor_amount || 0,
    originalMaterialAmount: railwayPayment.original_material_amount || 0,
    originalLaborAmount: railwayPayment.original_labor_amount || 0,
    itemName: railwayPayment.item_name || '',
    includesVAT: railwayPayment.includes_vat === 1,
    quickText: railwayPayment.quick_text || '',
    // 이미지는 크기가 크면 개수만 저장하고, 작으면 저장
    images: hasLargeImages ? [] : images.slice(0, 3), // 최대 3개만
    imageCount: images.length // 원래 이미지 개수 저장
  };
}

async function createFirestoreDoc(accessToken, collection, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = convertToFirestoreValue(value);
    }

    const body = JSON.stringify({ fields });

    // 문서 크기 체크 (Firestore 제한: 1MB)
    const bodySize = Buffer.byteLength(body);
    if (bodySize > 900000) {
      console.log(`    ⚠️ 문서 크기가 너무 큼 (${Math.round(bodySize/1024)}KB), 이미지 제외`);
      // 이미지를 제외하고 다시 시도
      data.images = [];
      const fields2 = {};
      for (const [key, value] of Object.entries(data)) {
        fields2[key] = convertToFirestoreValue(value);
      }
      return createFirestoreDoc(accessToken, collection, docId, data).then(resolve).catch(reject);
    }

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
  console.log('🔄 결제요청 마이그레이션 시작\n');

  // 1. Firestore 토큰 발급
  const firestoreToken = await getFirestoreToken();
  console.log('✅ Firestore 토큰 발급 완료\n');

  // 2. Railway에서 결제요청 목록 가져오기
  const payments = await getPaymentsFromRailway();
  console.log(`📦 Railway에서 ${payments.length}개 결제요청 조회\n`);

  // 3. Firestore에 결제요청 저장
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    try {
      const firestoreData = transformPaymentData(payment);
      const docId = String(payment.id);

      const result = await createFirestoreDoc(firestoreToken, 'payments', docId, firestoreData);

      if (result === 'exists') {
        await updateFirestoreDoc(firestoreToken, 'payments', docId, firestoreData);
        updated++;
        process.stdout.write(`\r  진행: ${i + 1}/${payments.length} (업데이트: ${updated}, 생성: ${created})`);
      } else {
        created++;
        process.stdout.write(`\r  진행: ${i + 1}/${payments.length} (업데이트: ${updated}, 생성: ${created})`);
      }
    } catch (error) {
      failed++;
      console.log(`\n  ❌ ID ${payment.id}: ${error.message}`);
    }

    // 속도 조절
    await new Promise(r => setTimeout(r, 50));
  }

  console.log('\n\n🎉 결제요청 마이그레이션 완료!');
  console.log(`  - 생성: ${created}`);
  console.log(`  - 업데이트: ${updated}`);
  console.log(`  - 실패: ${failed}`);
}

main().catch(console.error);
