/**
 * Railway 스펙북 이미지 -> Firebase Storage 마이그레이션
 */
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';
const PROJECT_ID = 'hv-lab-app';
const BUCKET = 'hv-lab-app.firebasestorage.app';

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getStorageToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
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

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function uploadToStorage(accessToken, path, imageBuffer, contentType = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const encodedPath = encodeURIComponent(path);
    const req = https.request({
      hostname: 'storage.googleapis.com',
      path: `/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodedPath}`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': contentType,
        'Content-Length': imageBuffer.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const result = JSON.parse(data);
          // Public URL 반환
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media`;
          resolve(publicUrl);
        } else {
          reject(new Error('Upload failed: ' + res.statusCode + ' ' + data.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(imageBuffer);
    req.end();
  });
}

function getContentType(url) {
  const ext = url.split('.').pop().toLowerCase().split('?')[0];
  const types = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  return types[ext] || 'image/jpeg';
}

async function main() {
  console.log('🚀 Railway -> Firebase Storage 마이그레이션 시작\n');

  const storageToken = await getStorageToken();
  console.log('✅ Storage 토큰 발급 완료\n');

  const items = await getItemList();
  console.log(`📦 총 ${items.length}개 아이템 조회\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    try {
      const detail = await getItemDetail(item.id);
      const images = [];

      // 메인 이미지
      if (detail.image && detail.image.includes('api.hvlab.app')) {
        images.push({ url: detail.image, type: 'main' });
      }

      // 서브 이미지
      if (detail.sub_images) {
        detail.sub_images.forEach((url, idx) => {
          if (url.includes('api.hvlab.app')) {
            images.push({ url, type: `sub_${idx}` });
          }
        });
      }

      if (images.length === 0) {
        skipped++;
        continue;
      }

      for (const img of images) {
        try {
          const imageBuffer = await downloadImage(img.url);
          const ext = img.url.split('.').pop().split('?')[0] || 'jpg';
          const storagePath = `specbook/${item.id}/${img.type}.${ext}`;
          const contentType = getContentType(img.url);

          await uploadToStorage(storageToken, storagePath, imageBuffer, contentType);
        } catch (imgErr) {
          console.log(`    ⚠️ ${img.type} 실패: ${imgErr.message.substring(0, 50)}`);
        }
      }

      migrated++;
      console.log(`  ✅ [${i+1}/${items.length}] ${item.name} - ${images.length}개 이미지`);

    } catch (error) {
      failed++;
      console.log(`  ❌ [${i+1}/${items.length}] ${item.name}: ${error.message.substring(0, 50)}`);
    }

    // 속도 조절
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n🎉 마이그레이션 완료!');
  console.log(`  - 성공: ${migrated}`);
  console.log(`  - 스킵 (Railway 이미지 없음): ${skipped}`);
  console.log(`  - 실패: ${failed}`);
}

main().catch(console.error);
