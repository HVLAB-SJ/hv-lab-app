/**
 * 크기 제한을 초과한 실행내역 레코드 동기화 (이미지 제외)
 */

const https = require('https');
const crypto = require('crypto');

const PROJECT_ID = 'hv-lab-app';
const serviceAccount = require('./serviceAccountKey.json');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';

// 실패한 레코드 ID들
const FAILED_IDS = [158, 76, 54, 52, 16, 13];

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

async function fetchRecordFromRailway(recordId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: `/api/execution-records/${recordId}`,
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

async function fetchAllRecordsFromRailway() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: `/api/execution-records`,
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

// 이미지 필드를 제거하고 크기가 큰 배열 데이터를 축소
function sanitizeRecord(record) {
  const sanitized = { ...record };

  // images 필드 제거 또는 축소
  if (sanitized.images && Array.isArray(sanitized.images)) {
    // 이미지 개수만 저장
    sanitized.images_count = sanitized.images.length;
    sanitized.images = []; // 빈 배열로 대체
  }

  // sub_images 필드 제거
  if (sanitized.sub_images) {
    sanitized.sub_images_count = sanitized.sub_images.length;
    sanitized.sub_images = [];
  }

  // details 필드가 너무 큰 경우 처리
  if (sanitized.details && Array.isArray(sanitized.details)) {
    sanitized.details = sanitized.details.map(detail => {
      const newDetail = { ...detail };
      // 상세 내역에서 이미지 제거
      if (newDetail.images) {
        newDetail.images_count = newDetail.images.length;
        newDetail.images = [];
      }
      return newDetail;
    });
  }

  return sanitized;
}

async function createFirestoreDoc(accessToken, docId, data) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== '_id') {
        fields[key] = convertToFirestoreValue(value);
      }
    }

    const body = JSON.stringify({ fields });
    const bodySize = Buffer.byteLength(body);

    console.log(`  문서 크기: ${(bodySize / 1024).toFixed(1)}KB`);

    if (bodySize > 1000000) {
      reject(new Error(`문서 크기 ${(bodySize / 1024 / 1024).toFixed(2)}MB - 여전히 너무 큼`));
      return;
    }

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/execution_records?documentId=${docId}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': bodySize
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== 크기 초과 실행내역 동기화 (이미지 제외) ===\n');

  try {
    console.log('Firestore 토큰 발급 중...');
    const firestoreToken = await getFirestoreToken();
    console.log('토큰 발급 완료\n');

    console.log('Railway에서 실행내역 가져오는 중...');
    const allRecords = await fetchAllRecordsFromRailway();
    console.log(`총 ${allRecords.length}개 레코드\n`);

    // 실패한 레코드만 필터링
    const failedRecords = allRecords.filter(r => FAILED_IDS.includes(r.id));
    console.log(`처리할 레코드: ${failedRecords.length}개\n`);

    let success = 0;
    let failed = 0;

    for (const record of failedRecords) {
      console.log(`\n처리 중: ID ${record.id} (${record.item_name || record.project_name})`);

      try {
        // 레코드 정리 (이미지 제거)
        const sanitizedRecord = sanitizeRecord(record);

        await createFirestoreDoc(firestoreToken, String(record.id), sanitizedRecord);
        success++;
        console.log(`  ✅ 성공`);
      } catch (error) {
        failed++;
        console.log(`  ❌ 실패: ${error.message}`);
      }
    }

    console.log('\n=== 결과 ===');
    console.log(`성공: ${success}개`);
    console.log(`실패: ${failed}개`);

    // 실패한 레코드의 금액 합계
    let failedTotal = 0;
    failedRecords.forEach(r => {
      failedTotal += (r.total_amount || 0);
    });
    console.log(`\n처리된 레코드 총액: ${failedTotal.toLocaleString()}원`);

  } catch (error) {
    console.error('에러:', error.message);
  }
}

main();
