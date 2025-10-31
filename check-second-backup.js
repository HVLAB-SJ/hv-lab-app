const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Find the second railway backup file
const files = fs.readdirSync(__dirname);
const railwayBackup = files.find(f => f.startsWith('railway-backup-2nd-') && f.endsWith('.db'));

if (!railwayBackup) {
  console.error('❌ 두 번째 Railway 백업 파일을 찾을 수 없습니다.');
  process.exit(1);
}

const dbPath = `./${railwayBackup}`;
console.log(`=== Railway 두 번째 백업 데이터베이스 분석 ===`);
console.log(`파일: ${railwayBackup}`);
console.log('');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('✅ 사용자 수:', row.count);
  }

  db.get('SELECT COUNT(*) as count FROM projects', [], (err, row) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('✅ 프로젝트 수:', row.count);
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

      db.get('SELECT COUNT(*) as count FROM payment_requests', [], (err, row) => {
        if (!err) {
          console.log('\n✅ 결제 요청:', row.count);
        }

        db.get('SELECT COUNT(*) as count FROM schedules', [], (err, row) => {
          if (!err) {
            console.log('✅ 일정:', row.count);
          }

          // Check AS requests
          db.get('SELECT COUNT(*) as count FROM as_requests', [], (err, row) => {
            if (!err && row) {
              console.log('✅ AS 요청:', row.count);
            }

            console.log('\n이 파일이 원하는 데이터를 가지고 있나요?');
            db.close();
          });
        });
      });
    });
  });
});
