const axios = require('axios');
const fs = require('fs');
const path = require('path');

const RAILWAY_URL = 'https://hv-lab-app-production.up.railway.app';

console.log('Railway 데이터베이스 상태 확인 중...');

axios.get(`${RAILWAY_URL}/api/admin/database-status`, {
  headers: {
    'Authorization': 'Bearer hvlab-admin-secret-2024'
  }
})
.then(response => {
  console.log('✅ Railway Database Status:');
  console.log(JSON.stringify(response.data, null, 2));

  if (response.data.users && response.data.projects) {
    console.log(`\n📊 Railway 데이터베이스:`);
    console.log(`   사용자: ${response.data.users}명`);
    console.log(`   프로젝트: ${response.data.projects}개`);
    console.log(`   크기: ${response.data.size} bytes`);
  }
})
.catch(error => {
  console.error('❌ Failed to check database status:');
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
  } else {
    console.error('Error:', error.message);
  }
});
