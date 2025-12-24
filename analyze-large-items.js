/**
 * 실패한 아이템의 대용량 필드 분석
 */
const https = require('https');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';

// 아직 1MB 초과인 아이템 ID
const STILL_FAILED_IDS = [160, 157, 78, 84];  // NEOREST NX, 웨이브 R 투피스, 웨이브 S 투피스, 모노플러스 8000

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
  return str.startsWith('data:image') ||
         (str.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)));
}

function analyzeObject(obj, path = '', results = []) {
  if (typeof obj === 'string' && isBase64Image(obj)) {
    results.push({ path, size: obj.length, type: 'base64' });
  } else if (typeof obj === 'string' && obj.length > 1000) {
    results.push({ path, size: obj.length, type: 'string' });
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) => analyzeObject(item, path + '[' + idx + ']', results));
  } else if (typeof obj === 'object' && obj !== null) {
    Object.entries(obj).forEach(([key, value]) =>
      analyzeObject(value, path ? path + '.' + key : key, results)
    );
  }
  return results;
}

async function main() {
  console.log('📊 실패한 아이템의 대용량 필드 분석\n');

  for (const id of STILL_FAILED_IDS) {
    const detail = await getItemDetail(id);
    console.log('━'.repeat(60));
    console.log('📦', detail.name, '(ID:', id, ')');
    console.log('  전체 크기:', JSON.stringify(detail).length.toLocaleString(), 'bytes');

    const largeFields = analyzeObject(detail);
    const sortedFields = largeFields.sort((a, b) => b.size - a.size).slice(0, 10);

    console.log('\n  대용량 필드 (상위 10개):');
    sortedFields.forEach(f => {
      console.log('    ', f.path, ':', f.size.toLocaleString(), 'bytes', f.type === 'base64' ? '[BASE64]' : '');
    });
    console.log('');
  }
}

main().catch(console.error);
