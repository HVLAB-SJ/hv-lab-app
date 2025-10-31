const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('=== Checking Local Database ===');
console.log('Database path:', dbPath);

db.all('SELECT COUNT(*) as count FROM users', [], (err, rows) => {
  if (err) {
    console.error('Error checking users:', err);
  } else {
    console.log('Users count:', rows[0].count);
  }

  db.all('SELECT COUNT(*) as count FROM projects', [], (err, rows) => {
    if (err) {
      console.error('Error checking projects:', err);
    } else {
      console.log('Projects count:', rows[0].count);
    }

    db.all('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name', [], (err, rows) => {
      if (err) {
        console.error('Error checking tables:', err);
      } else {
        console.log('\nAll tables in database:');
        rows.forEach(row => console.log('  -', row.name));
      }

      db.close();
    });
  });
});
