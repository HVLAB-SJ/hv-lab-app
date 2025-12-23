/**
 * Railway와 Firebase의 execution_records 데이터 비교
 */

const https = require('https');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';

// Railway API에서 조회
function fetchRailway(endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api' + endpoint,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('JSON parse error: ' + body.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Firebase API에서 조회
function fetchFirebase(endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'asia-northeast3-hv-lab-app.cloudfunctions.net',
      path: '/api' + endpoint,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('JSON parse error: ' + body.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== 실행내역(execution_records) 데이터 비교 ===\n');

  try {
    const railway = await fetchRailway('/execution-records');
    console.log('Railway execution_records:', railway.length, '개');

    // 총액 계산
    let railwayTotal = 0;
    railway.forEach(r => {
      railwayTotal += (r.total_amount || 0);
    });
    console.log('Railway 총액:', railwayTotal.toLocaleString(), '원');

    // 프로젝트별 통계
    const railwayByProject = {};
    railway.forEach(r => {
      const project = r.project_name || '미지정';
      if (!railwayByProject[project]) {
        railwayByProject[project] = { count: 0, total: 0 };
      }
      railwayByProject[project].count++;
      railwayByProject[project].total += (r.total_amount || 0);
    });

    console.log('\n=== Railway 프로젝트별 통계 ===');
    Object.entries(railwayByProject)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([project, stats]) => {
        console.log(project + ': ' + stats.count + '개, ' + stats.total.toLocaleString() + '원');
      });

    // 부암동 빌라_301 데이터 상세
    console.log('\n=== 부암동 빌라_301 상세 ===');
    const buamRecords = railway.filter(r => r.project_name === '부암동 빌라_301');
    console.log('레코드 수:', buamRecords.length);
    buamRecords.forEach((r, i) => {
      console.log((i+1) + '. ' + r.item_name + ' | ' + (r.total_amount || 0).toLocaleString() + '원 | ' + r.date);
    });

  } catch (error) {
    console.error('Railway 에러:', error.message);
  }

  console.log('\n\n--- Firebase 조회 ---');
  try {
    const firebase = await fetchFirebase('/execution-records');
    console.log('Firebase execution_records:', firebase.length, '개');

    let firebaseTotal = 0;
    firebase.forEach(r => {
      firebaseTotal += (r.total_amount || 0);
    });
    console.log('Firebase 총액:', firebaseTotal.toLocaleString(), '원');

    // Firebase 프로젝트별 통계
    const firebaseByProject = {};
    firebase.forEach(r => {
      const project = r.project_name || '미지정';
      if (!firebaseByProject[project]) {
        firebaseByProject[project] = { count: 0, total: 0 };
      }
      firebaseByProject[project].count++;
      firebaseByProject[project].total += (r.total_amount || 0);
    });

    console.log('\n=== Firebase 프로젝트별 통계 ===');
    Object.entries(firebaseByProject)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([project, stats]) => {
        console.log(project + ': ' + stats.count + '개, ' + stats.total.toLocaleString() + '원');
      });

  } catch (error) {
    console.error('Firebase 에러:', error.message);
  }
}

main();
