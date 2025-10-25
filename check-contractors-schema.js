const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('=== Contractors 테이블 스키마 확인 ===\n');

// Check table schema
db.all("PRAGMA table_info(contractors)", [], (err, columns) => {
  if (err) {
    console.error('Error checking schema:', err);
  } else {
    console.log('Contractors 테이블 컬럼:');
    columns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
  }

  console.log('\n=== 샘플 데이터 확인 ===\n');

  // Get sample data
  db.all("SELECT * FROM contractors LIMIT 5", [], (err, rows) => {
    if (err) {
      console.error('Error fetching data:', err);
    } else {
      console.log('샘플 데이터:');
      rows.forEach((row, index) => {
        console.log(`\n레코드 ${index + 1}:`);
        Object.keys(row).forEach(key => {
          if (row[key]) {
            console.log(`  ${key}: ${row[key]}`);
          }
        });
      });
    }

    console.log('\n=== 목공 관련 협력업체 확인 ===\n');

    // Check for 목공 contractors - trying different column names
    db.all("SELECT * FROM contractors WHERE name LIKE '%목공%' OR notes LIKE '%목공%' OR contact LIKE '%목공%'", [], (err, rows) => {
      if (err) {
        console.error('Error:', err);
      } else if (rows.length > 0) {
        console.log(`목공 관련 협력업체 ${rows.length}개 발견:`);
        rows.forEach(row => {
          console.log(`\n- ID: ${row.id}`);
          console.log(`  이름: ${row.name}`);
          if (row.position) console.log(`  직책: ${row.position}`);
          if (row.notes) console.log(`  비고: ${row.notes}`);
          if (row.contact) console.log(`  연락처: ${row.contact}`);
        });
      } else {
        console.log('목공 관련 협력업체를 찾을 수 없습니다.');
      }

      db.close();
    });
  });
});