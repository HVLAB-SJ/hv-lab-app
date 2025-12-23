/**
 * Railway에서 payment_requests 데이터의 status 확인
 */

const https = require('https');

const RAILWAY_API = 'api.hvlab.app';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';

async function fetchFromRailway(endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: RAILWAY_API,
      path: `/api${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON: ' + body.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Railway 결제요청 데이터 조회 중...\n');

  try {
    const payments = await fetchFromRailway('/payments');

    console.log('총 문서 수:', payments.length);
    console.log('\n각 문서의 status 값:');

    payments.forEach((payment, i) => {
      const status = payment.status || 'undefined';
      console.log(`${i+1}. ID: ${payment.id || payment._id}, status: "${status}", project: ${payment.project_name || 'N/A'}, amount: ${payment.amount || 'N/A'}`);
    });

    // status 값 통계
    const statusCounts = {};
    payments.forEach(p => {
      const status = p.status || 'undefined';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('\n=== Status 통계 ===');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`${status}: ${count}개`);
    });

    // pending 상태의 결제요청이 있는지 확인
    const pendingPayments = payments.filter(p => p.status !== 'completed');
    if (pendingPayments.length > 0) {
      console.log('\n=== 대기중(pending) 결제요청 ===');
      pendingPayments.forEach(p => {
        console.log(`  ID: ${p.id || p._id}, status: "${p.status}", project: ${p.project_name}, amount: ${p.amount}`);
      });
    }

  } catch (error) {
    console.error('에러:', error.message);
  }
}

main();
