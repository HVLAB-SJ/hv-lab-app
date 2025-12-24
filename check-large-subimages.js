/**
 * 대용량 서브이미지 내용 확인
 */
const https = require('https');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';

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

async function main() {
  console.log('📊 대용량 서브이미지 내용 확인\n');

  // NEOREST NX (ID: 160)
  const item = await getItemDetail(160);
  console.log('아이템:', item.name);
  console.log('sub_images 개수:', item.sub_images?.length || 0);

  if (item.sub_images && item.sub_images.length > 0) {
    item.sub_images.forEach((img, idx) => {
      console.log(`\n--- sub_images[${idx}] ---`);
      console.log('타입:', typeof img);
      console.log('길이:', img.length.toLocaleString(), 'bytes');
      console.log('시작 50자:', img.substring(0, 50));
      console.log('data:image 시작?:', img.startsWith('data:image'));
      console.log('http 시작?:', img.startsWith('http'));

      // base64 문자열 검사
      if (!img.startsWith('data:image') && !img.startsWith('http')) {
        console.log('첫 100자 base64 검사:', /^[A-Za-z0-9+/=]+$/.test(img.substring(0, 100)));
      }
    });
  }
}

main().catch(console.error);
