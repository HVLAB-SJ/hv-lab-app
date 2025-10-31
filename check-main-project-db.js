const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'C:\\Users\\kim_s\\Desktop\\HV_LAB_BACKUP_2025-10-26_045145\\main-project\\database.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

console.log('=== main-project 폴더의 데이터베이스 정보 ===');
console.log('Path:', dbPath);
console.log('');

db.all('SELECT COUNT(*) as count FROM users', [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('✅ 사용자 수:', rows[0].count);
  }

  db.all('SELECT COUNT(*) as count FROM projects', [], (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('✅ 프로젝트 수:', rows[0].count);
    }

    // List all projects
    db.all('SELECT id, name, client FROM projects ORDER BY id', [], (err, projects) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('\n프로젝트 목록:');
        projects.forEach(p => {
          console.log(`  ${p.id}. ${p.name} (${p.client || 'N/A'})`);
        });
      }

      db.all('SELECT COUNT(*) as count FROM payment_requests', [], (err, rows) => {
        if (!err) {
          console.log('\n✅ 결제 요청:', rows[0].count);
        }

        db.all('SELECT COUNT(*) as count FROM schedules', [], (err, rows) => {
          if (!err) {
            console.log('✅ 일정:', rows[0].count);
          }

          db.close();
        });
      });
    });
  });
});
