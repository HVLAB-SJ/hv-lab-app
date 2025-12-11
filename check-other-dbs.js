const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// 확인할 추가 데이터베이스 파일들
const additionalDbs = [
  'interior-schedule.db',
  'construction_schedule.db'
];

function checkDatabase(filename) {
  return new Promise((resolve) => {
    // 파일 크기 확인
    const stats = fs.statSync(filename);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    const db = new sqlite3.Database(filename, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.log(`❌ ${filename} (${fileSizeMB}MB) - 열기 실패`);
        resolve(null);
        return;
      }

      console.log(`\n📁 ${filename} (${fileSizeMB}MB)`);

      // 모든 테이블 목록 가져오기
      db.all(`SELECT name FROM sqlite_master WHERE type='table'`, (err, tables) => {
        if (err || !tables) {
          console.log(`  테이블 조회 실패`);
          db.close();
          resolve(null);
          return;
        }

        console.log(`  테이블 수: ${tables.length}개`);

        // site_logs 테이블 확인
        const hasSiteLogs = tables.some(t => t.name === 'site_logs');

        if (hasSiteLogs) {
          // site_logs 데이터 확인
          db.get(`SELECT COUNT(*) as count, SUM(LENGTH(images)) as total_size FROM site_logs`, (err, result) => {
            if (!err && result) {
              console.log(`  ✅ site_logs 테이블 발견!`);
              console.log(`     - 현장일지: ${result.count}개`);
              console.log(`     - 이미지 데이터: ${((result.total_size || 0) / 1024 / 1024).toFixed(2)}MB`);

              // 최신 데이터 확인
              db.get(`SELECT date, project FROM site_logs ORDER BY created_at DESC LIMIT 1`, (err, latest) => {
                if (!err && latest) {
                  console.log(`     - 최신: ${latest.project} (${latest.date})`);
                }
                db.close();
                resolve({ filename, hasSiteLogs: true, count: result.count });
              });
            } else {
              console.log(`  site_logs 테이블은 있지만 데이터 조회 실패`);
              db.close();
              resolve({ filename, hasSiteLogs: true, count: 0 });
            }
          });
        } else {
          // 다른 테이블들 표시
          const tableNames = tables.map(t => t.name).slice(0, 5);
          console.log(`  주요 테이블: ${tableNames.join(', ')}${tables.length > 5 ? '...' : ''}`);
          db.close();
          resolve({ filename, hasSiteLogs: false, count: 0 });
        }
      });
    });
  });
}

async function checkAllDatabases() {
  console.log('=== 추가 데이터베이스 파일 확인 ===\n');

  const results = [];

  for (const file of additionalDbs) {
    if (fs.existsSync(file)) {
      const result = await checkDatabase(file);
      if (result) results.push(result);
    }
  }

  // 결과 요약
  console.log('\n=== 요약 ===');
  const dbsWithSiteLogs = results.filter(r => r.hasSiteLogs && r.count > 0);

  if (dbsWithSiteLogs.length > 0) {
    console.log('\n🎉 현장일지 데이터를 찾았습니다!');
    dbsWithSiteLogs.forEach(db => {
      console.log(`  ✅ ${db.filename}: ${db.count}개의 현장일지`);
    });
  } else {
    console.log('\n😞 추가 데이터베이스에도 현장일지가 없습니다.');
  }
}

checkAllDatabases().catch(console.error);