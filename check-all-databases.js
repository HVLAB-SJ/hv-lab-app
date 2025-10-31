const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbFiles = [
  'database.db',
  'construction_schedule.db',
  'interior-schedule.db'
];

dbFiles.forEach(dbFile => {
  const dbPath = path.join(__dirname, dbFile);

  if (!fs.existsSync(dbPath)) {
    console.log(`❌ ${dbFile} - 파일 없음`);
    return;
  }

  const stats = fs.statSync(dbPath);
  console.log(`\n==========================================`);
  console.log(`📁 ${dbFile}`);
  console.log(`   크기: ${stats.size} bytes`);
  console.log(`   수정일: ${stats.mtime.toLocaleString('ko-KR')}`);
  console.log(`==========================================`);

  if (stats.size === 0) {
    console.log('⚠️  빈 파일입니다\n');
    return;
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.log('❌ 데이터베이스 열기 실패:', err.message);
      return;
    }

    db.all('SELECT COUNT(*) as count FROM projects', [], (err, rows) => {
      if (err) {
        console.log('⚠️  projects 테이블 없음 또는 오류');
      } else {
        console.log(`✅ 프로젝트 수: ${rows[0].count}`);

        if (rows[0].count > 0) {
          db.all('SELECT id, name, client FROM projects ORDER BY id LIMIT 10', [], (err, projects) => {
            if (!err && projects) {
              console.log('\n프로젝트 목록 (최대 10개):');
              projects.forEach(p => {
                console.log(`  ${p.id}. ${p.name} (${p.client || 'N/A'})`);
              });
            }
          });
        }
      }

      db.all('SELECT COUNT(*) as count FROM payment_requests', [], (err, rows) => {
        if (!err) {
          console.log(`✅ 결제 요청: ${rows[0].count}`);
        }

        db.all('SELECT COUNT(*) as count FROM schedules', [], (err, rows) => {
          if (!err) {
            console.log(`✅ 일정: ${rows[0].count}`);
          }

          db.all('SELECT COUNT(*) as count FROM users', [], (err, rows) => {
            if (!err) {
              console.log(`✅ 사용자: ${rows[0].count}`);
            }
            console.log('');
            db.close();
          });
        });
      });
    });
  });
});

setTimeout(() => {
  console.log('\n\n💡 가장 많은 데이터가 있는 파일을 찾았나요?');
}, 2000);
