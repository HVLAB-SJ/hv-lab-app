const https = require('https');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';

// Railway API에서 실행내역 확인
async function getExecutionRecords() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api/execution-records',
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

async function main() {
  console.log('Railway API에서 실행내역 확인...');

  const records = await getExecutionRecords();
  console.log('총 실행내역:', records.length);

  // author 필드 상태 확인
  let withAuthor = 0;
  let withoutAuthor = 0;
  const authors = {};

  records.forEach(r => {
    if (r.author && r.author.trim()) {
      withAuthor++;
      authors[r.author] = (authors[r.author] || 0) + 1;
    } else {
      withoutAuthor++;
    }
  });

  console.log('\n작성자 있음:', withAuthor);
  console.log('작성자 없음:', withoutAuthor);

  console.log('\n작성자별 개수:');
  Object.entries(authors).sort((a, b) => b[1] - a[1]).forEach(([author, count]) => {
    console.log('  -', author + ':', count);
  });

  // 작성자 없는 내역 샘플
  if (withoutAuthor > 0) {
    console.log('\n작성자 없는 내역 샘플:');
    const noAuthorRecords = records.filter(r => !r.author || !r.author.trim());
    noAuthorRecords.slice(0, 5).forEach(r => {
      console.log('  ID:', r.id, '| 프로젝트:', r.project_name, '| 품명:', r.item_name);
    });
  }
}

main().catch(console.error);
