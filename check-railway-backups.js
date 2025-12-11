const sqlite3 = require('sqlite3').verbose();

// Railway 백업 파일들
const railwayBackups = [
  'railway-backup-1761938060292.db',
  'railway-backup-2nd-1761938113551.db',
  'railway-database.db'
];

function checkBackupFile(filename) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filename, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.log(`❌ ${filename} 열기 실패:`, err.message);
        resolve(null);
        return;
      }

      console.log(`\n=== ${filename} 확인 중 ===`);

      // site_logs 테이블 확인
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='site_logs'`, (err, row) => {
        if (err || !row) {
          console.log(`  site_logs 테이블 없음`);
          db.close();
          resolve(null);
          return;
        }

        // 현장일지 데이터 확인
        db.all(`SELECT
            id,
            project,
            date,
            LENGTH(images) as images_length,
            created_at
          FROM site_logs
          ORDER BY created_at DESC
          LIMIT 10`, (err, rows) => {
          if (err) {
            console.log(`  조회 실패:`, err.message);
            db.close();
            resolve(null);
            return;
          }

          console.log(`  최근 현장일지: ${rows.length}개`);

          let totalImageData = 0;
          rows.forEach((row, idx) => {
            console.log(`  ${idx + 1}. ${row.project} (${row.date})`);
            console.log(`     이미지 데이터 크기: ${(row.images_length / 1024 / 1024).toFixed(2)} MB`);
            totalImageData += row.images_length;
          });

          // 전체 통계
          db.get(`SELECT
              COUNT(*) as total_logs,
              SUM(LENGTH(images)) as total_image_size
            FROM site_logs`, (err, stats) => {
            if (!err && stats) {
              console.log(`\n  === 전체 통계 ===`);
              console.log(`  총 현장일지: ${stats.total_logs}개`);
              console.log(`  총 이미지 데이터: ${(stats.total_image_size / 1024 / 1024).toFixed(2)} MB`);
            }

            // 가장 최근 데이터 날짜
            db.get(`SELECT MAX(created_at) as latest FROM site_logs`, (err, latest) => {
              if (!err && latest) {
                console.log(`  가장 최근 데이터: ${latest.latest}`);
              }

              db.close();
              resolve({
                filename,
                hasData: rows.length > 0,
                totalLogs: stats?.total_logs || 0,
                totalSize: stats?.total_image_size || 0
              });
            });
          });
        });
      });
    });
  });
}

// 모든 Railway 백업 확인
async function checkRailwayBackups() {
  console.log('Railway 백업 파일 확인 중...\n');

  const results = [];
  for (const file of railwayBackups) {
    const result = await checkBackupFile(file);
    if (result) {
      results.push(result);
    }
  }

  // 결과 요약
  console.log('\n=== Railway 백업 요약 ===');
  const filesWithData = results.filter(r => r.hasData);

  if (filesWithData.length > 0) {
    console.log('\n✅ 현장일지 데이터가 있는 Railway 백업:');
    filesWithData.forEach(f => {
      console.log(`  - ${f.filename}`);
      console.log(`    현장일지: ${f.totalLogs}개`);
      console.log(`    데이터 크기: ${(f.totalSize / 1024 / 1024).toFixed(2)} MB`);
    });

    // 가장 많은 데이터가 있는 파일
    const bestBackup = filesWithData.reduce((max, f) =>
      f.totalLogs > max.totalLogs ? f : max
    );

    console.log(`\n💡 복구 추천: ${bestBackup.filename}`);
    console.log(`   (${bestBackup.totalLogs}개의 현장일지, ${(bestBackup.totalSize / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    console.log('\n⚠️ Railway 백업에도 현장일지 데이터가 없습니다.');
  }
}

checkRailwayBackups().catch(console.error);