const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('데이터베이스 경로:', dbPath);

db.all('SELECT * FROM quote_inquiries ORDER BY created_at DESC', [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }

  console.log('\n견적문의 데이터:', rows.length, '개');
  rows.forEach((row, index) => {
    console.log(`\n[${index + 1}]`);
    console.log('ID:', row.id);
    console.log('이름:', row.name);
    console.log('이메일:', row.email);
    console.log('전화:', row.phone);
    console.log('읽음:', row.is_read ? 'O' : 'X');
    console.log('생성일:', row.created_at);
  });

  db.close();
});
