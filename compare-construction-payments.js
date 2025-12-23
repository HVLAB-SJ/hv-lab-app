/**
 * Railway와 Firebase 실행내역 데이터 비교
 */

const https = require('https');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiLsg4HspIAiLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTc2NjQ5ODI1OSwiZXhwIjoyMDgxODU4MjU5fQ.pyGPi-qKcLZuIgrqkxmpu5zQpBtomdiaw8u1biDUq0U';

async function fetchRailway() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.hvlab.app',
      path: '/api/construction-payments',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchFirebase() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'asia-northeast3-hv-lab-app.cloudfunctions.net',
      path: '/api/construction-payments',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== 실행내역 데이터 비교 ===\n');

  const railway = await fetchRailway();
  const firebase = await fetchFirebase();

  console.log('Railway:', railway.length, '개');
  console.log('Firebase:', firebase.length, '개');

  // 최신 5개 비교
  console.log('\n=== Railway 최신 5개 ===');
  railway.slice(0, 5).forEach((item, i) => {
    console.log((i+1) + '. ID:', item.id, '| 날짜:', item.date, '| 프로젝트:', item.project_name || item.projectId);
  });

  console.log('\n=== Firebase 최신 5개 ===');
  firebase.slice(0, 5).forEach((item, i) => {
    console.log((i+1) + '. ID:', item.id, '| 날짜:', item.date, '| 프로젝트:', item.project_name || item.projectId);
  });

  // 누락된 항목 확인
  const railwayIds = new Set(railway.map(r => String(r.id)));
  const firebaseIds = new Set(firebase.map(f => String(f.id)));

  const missingInFirebase = railway.filter(r => !firebaseIds.has(String(r.id)));
  const extraInFirebase = firebase.filter(f => !railwayIds.has(String(f.id)));

  console.log('\n=== 누락/추가 분석 ===');
  console.log('Firebase에 없는 항목:', missingInFirebase.length, '개');
  console.log('Railway에 없는 항목:', extraInFirebase.length, '개');

  if (missingInFirebase.length > 0) {
    console.log('\n=== Firebase에 없는 항목 (최대 10개) ===');
    missingInFirebase.slice(0, 10).forEach((item, i) => {
      console.log((i+1) + '. ID:', item.id, '| 날짜:', item.date, '| 프로젝트:', item.project_name);
    });
  }
}

main().catch(console.error);
