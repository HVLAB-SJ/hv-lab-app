/**
 * Railway에서 Firestore로 sub_images 동기화
 * - 모든 스펙북 아이템의 sub_images를 업데이트
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
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.name) {
            reject(new Error('Invalid item'));
            return;
          }
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function updateFirestoreSubImages(accessToken, docId, subImages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      fields: {
        sub_images: {
          arrayValue: {
            values: subImages.map(img => ({ stringValue: img }))
          }
        }
      }
    });

    // 크기 체크 (1MB 제한)
    const bodySize = Buffer.byteLength(body);
    if (bodySize > 900000) {
      reject(new Error('sub_images too large: ' + (bodySize / 1024).toFixed(0) + 'KB'));
      return;
    }

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/specbook_items/' + docId + '?updateMask.fieldPaths=sub_images',
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
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
          reject(new Error('HTTP ' + res.statusCode + ': ' + data.substring(0, 100)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Railway -> Firestore sub_images 동기화 ===\n');

  const firestoreToken = await getFirestoreToken();
  console.log('Firestore 토큰 발급 완료\n');

  const items = await getItemList();
  console.log('Railway 아이템:', items.length, '개\n');

  let synced = 0;
  let noImages = 0;
  let failed = 0;
  let tooLarge = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const detail = await getItemDetail(item.id);

      if (detail.sub_images && detail.sub_images.length > 0) {
        await updateFirestoreSubImages(firestoreToken, String(item.id), detail.sub_images);
        synced++;
        console.log('[' + (i + 1) + '/' + items.length + '] ' + item.name + ' - ' + detail.sub_images.length + '개 이미지');
      } else {
        noImages++;
      }
    } catch (error) {
      if (error.message.includes('too large')) {
        tooLarge++;
        console.log('[' + (i + 1) + '/' + items.length + '] ' + item.name + ' - 크기 초과');
      } else {
        failed++;
        console.log('[' + (i + 1) + '/' + items.length + '] ' + item.name + ' - 실패: ' + error.message.substring(0, 50));
      }
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n=== 결과 ===');
  console.log('동기화 성공:', synced);
  console.log('이미지 없음:', noImages);
  console.log('크기 초과:', tooLarge);
  console.log('실패:', failed);
}

main().catch(console.error);
