const axios = require('axios');
const fs = require('fs');

const RAILWAY_URL = 'https://hv-lab-app-production.up.railway.app';
const BACKUP_FILENAME = 'database.db.backup-1761936505676'; // The larger 144KB backup

console.log(`📥 Railway 백업 다운로드 중: ${BACKUP_FILENAME}\n`);

axios.get(`${RAILWAY_URL}/api/admin/download-backup/${BACKUP_FILENAME}`, {
  headers: {
    'Authorization': 'Bearer hvlab-admin-secret-2024'
  }
})
.then(response => {
  if (response.data.success) {
    console.log('✅ 백업 다운로드 성공!');
    console.log(`   크기: ${response.data.size} bytes`);

    // Decode and save
    const dbBuffer = Buffer.from(response.data.database, 'base64');
    const savePath = `railway-backup-${Date.now()}.db`;
    fs.writeFileSync(savePath, dbBuffer);

    console.log(`   저장 위치: ${savePath}\n`);
    console.log('이제 이 파일의 내용을 확인하겠습니다...');
  } else {
    console.error('❌ 백업 다운로드 실패');
  }
})
.catch(error => {
  console.error('❌ Failed to download backup:');
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
  } else {
    console.error('Error:', error.message);
  }
});
