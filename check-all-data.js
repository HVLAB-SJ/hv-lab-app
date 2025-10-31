const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('=== 데이터베이스 상세 정보 ===');
console.log('Database path:', dbPath);
console.log('');

// 사용자 수
db.all('SELECT COUNT(*) as count FROM users', [], (err, rows) => {
  if (err) {
    console.error('Error checking users:', err);
  } else {
    console.log('✅ 사용자 수:', rows[0].count);
  }

  // 프로젝트 수와 상세 정보
  db.all('SELECT COUNT(*) as count FROM projects', [], (err, rows) => {
    if (err) {
      console.error('Error checking projects:', err);
    } else {
      console.log('✅ 프로젝트 수:', rows[0].count);
    }

    // 프로젝트 목록
    db.all('SELECT id, name, client FROM projects ORDER BY id', [], (err, projects) => {
      if (err) {
        console.error('Error getting projects:', err);
      } else {
        console.log('\n프로젝트 목록:');
        projects.forEach(p => {
          console.log(`  ${p.id}. ${p.name} (고객: ${p.client || 'N/A'})`);
        });
      }

      // 결제 데이터 수
      db.all('SELECT COUNT(*) as count FROM payment_requests', [], (err, rows) => {
        if (err) {
          console.error('Error checking payments:', err);
        } else {
          console.log('\n✅ 결제 요청 수:', rows[0].count);
        }

        // AS 요청 수
        db.all('SELECT COUNT(*) as count FROM as_requests', [], (err, rows) => {
          if (err) {
            console.error('Error checking as_requests:', err);
          } else {
            console.log('✅ AS 요청 수:', rows[0].count);
          }

          // 일정 수
          db.all('SELECT COUNT(*) as count FROM schedules', [], (err, rows) => {
            if (err) {
              console.error('Error checking schedules:', err);
            } else {
              console.log('✅ 일정 수:', rows[0].count);
            }

            db.close();
          });
        });
      });
    });
  });
});
