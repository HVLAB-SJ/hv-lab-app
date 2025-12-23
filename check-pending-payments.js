/**
 * Firebase API를 통해 결제요청 status 확인
 */

const https = require('https');

// Firebase Functions API 사용
const FIREBASE_API = 'asia-northeast3-hv-lab-app.cloudfunctions.net';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';

async function fetchFromFirebase(endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: FIREBASE_API,
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
          reject(new Error('Invalid JSON: ' + body.substring(0, 500)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Firebase API를 통해 결제요청 조회 중...\n');

  try {
    const payments = await fetchFromFirebase('/payments');

    console.log('총 결제요청 수:', payments.length);

    // status 값 통계
    const statusCounts = {};
    const pendingPayments = [];

    payments.forEach(p => {
      const status = p.status || 'undefined';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (status !== 'completed') {
        pendingPayments.push(p);
      }
    });

    console.log('\n=== Status 통계 ===');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`${status}: ${count}개`);
    });

    if (pendingPayments.length > 0) {
      console.log('\n=== 대기중 결제요청 상세 ===');
      pendingPayments.forEach((p, i) => {
        console.log(`${i+1}. ID: ${p.id}, status: "${p.status}", project: ${p.project_name}, amount: ${p.amount}`);
      });
    } else {
      console.log('\n대기중인 결제요청이 없습니다.');
    }

  } catch (error) {
    console.error('에러:', error.message);
  }
}

main();
