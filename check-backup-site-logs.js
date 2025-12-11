const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 백업 파일들 목록
const backupFiles = [
  'database-backup-1763034179600.db',
  'database-backup-20250119.db',
  'database-backup-271bc0a.db'
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

      // site_logs 테이블 존재 여부 확인
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='site_logs'`, (err, row) => {
        if (err || !row) {
          console.log(`  site_logs 테이블 없음`);
          db.close();
          resolve(null);
          return;
        }

        // 현장일지 데이터 확인
        db.all(`SELECT id, project, date, images, created_at FROM site_logs ORDER BY created_at DESC LIMIT 5`, (err, rows) => {
          if (err) {
            console.log(`  조회 실패:`, err.message);
            db.close();
            resolve(null);
            return;
          }

          console.log(`  현장일지 수: ${rows.length}개`);

          if (rows.length > 0) {
            let totalImages = 0;
            rows.forEach(row => {
              try {
                const images = JSON.parse(row.images || '[]');
                totalImages += images.length;
                if (images.length > 0) {
                  console.log(`  - ${row.project} (${row.date}): ${images.length}개 이미지`);
                }
              } catch (e) {
                // 파싱 실패 무시
              }
            });

            console.log(`  총 이미지 수: ${totalImages}개`);

            // 전체 통계
            db.get(`SELECT COUNT(*) as total FROM site_logs`, (err, stats) => {
              if (!err && stats) {
                console.log(`  전체 현장일지: ${stats.total}개`);
              }
              db.close();
              resolve({ filename, hasData: true, totalLogs: stats?.total || 0 });
            });
          } else {
            db.close();
            resolve({ filename, hasData: false, totalLogs: 0 });
          }
        });
      });
    });
  });
}

// 모든 백업 파일 확인
async function checkAllBackups() {
  console.log('백업 파일에서 현장일지 데이터 확인 중...\n');

  const results = [];
  for (const file of backupFiles) {
    const result = await checkBackupFile(file);
    if (result) {
      results.push(result);
    }
  }

  // 결과 요약
  console.log('\n=== 백업 파일 요약 ===');
  const filesWithData = results.filter(r => r.hasData);

  if (filesWithData.length > 0) {
    console.log('\n현장일지 데이터가 있는 백업 파일:');
    filesWithData.forEach(f => {
      console.log(`  ✅ ${f.filename}: ${f.totalLogs}개의 현장일지`);
    });

    // 가장 많은 데이터가 있는 파일 찾기
    const bestBackup = filesWithData.reduce((max, f) =>
      f.totalLogs > max.totalLogs ? f : max
    );

    console.log(`\n💡 추천: ${bestBackup.filename} 파일로 복구하는 것을 권장합니다.`);
  } else {
    console.log('\n⚠️ 백업 파일에도 현장일지 데이터가 없습니다.');
  }
}

checkAllBackups().catch(console.error);