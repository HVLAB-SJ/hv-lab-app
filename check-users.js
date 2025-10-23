const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

db.all('SELECT username, name FROM users ORDER BY id', [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('현재 데이터베이스 사용자 목록:\n');
    rows.forEach(r => {
      console.log(`  username: "${r.username}", name: "${r.name}"`);
    });
  }
  db.close();
});
