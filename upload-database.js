const fs = require('fs');
const path = require('path');

// Read local database file
const dbPath = path.join(__dirname, 'database.db');
const dbData = fs.readFileSync(dbPath);
const base64Data = dbData.toString('base64');

console.log('Database file size:', dbData.length, 'bytes');
console.log('Uploading to Railway...');

// Upload to Railway
const fetch = require('axios');
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://hv-lab-app-production.up.railway.app';

fetch.post(`${RAILWAY_URL}/api/admin/upload-database`, {
  database: base64Data
}, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer hvlab-admin-secret-2024'
  }
})
.then(response => {
  console.log('✅ Database uploaded successfully!');
  console.log('Response:', response.data);
})
.catch(error => {
  console.error('❌ Failed to upload database:');
  console.error(error.response?.data || error.message);
});
