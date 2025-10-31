const axios = require('axios');

const RAILWAY_URL = 'https://hv-lab-app-production.up.railway.app';

console.log('Checking Railway database status...');

axios.get(`${RAILWAY_URL}/api/admin/database-status`, {
  headers: {
    'Authorization': 'Bearer hvlab-admin-secret-2024'
  }
})
.then(response => {
  console.log('✅ Database Status:');
  console.log(JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.error('❌ Failed to check database status:');
  console.error(error.response?.data || error.message);
});
