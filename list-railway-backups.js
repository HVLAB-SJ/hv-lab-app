const axios = require('axios');

const RAILWAY_URL = 'https://hv-lab-app-production.up.railway.app';

console.log('Railway 백업 파일 목록 확인 중...\n');

axios.get(`${RAILWAY_URL}/api/admin/list-backups`, {
  headers: {
    'Authorization': 'Bearer hvlab-admin-secret-2024'
  }
})
.then(response => {
  console.log('✅ Railway Backup Files:');

  if (response.data.backups && response.data.backups.length > 0) {
    console.log(`\n총 ${response.data.backups.length}개의 백업 파일 발견:\n`);

    response.data.backups.forEach((backup, index) => {
      const sizeKB = Math.round(backup.size / 1024);
      const date = new Date(backup.modified);
      console.log(`${index + 1}. ${backup.name}`);
      console.log(`   크기: ${sizeKB} KB`);
      console.log(`   수정: ${date.toLocaleString('ko-KR')}`);
      console.log(`   경로: ${backup.path}\n`);
    });
  } else {
    console.log('백업 파일이 없습니다.');
  }
})
.catch(error => {
  console.error('❌ Failed to list backups:');
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
  } else {
    console.error('Error:', error.message);
  }
});
