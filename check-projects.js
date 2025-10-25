const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

const query = `SELECT * FROM projects`;

db.all(query, [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }

  console.log('Found', rows.length, 'projects');
  rows.forEach((row, i) => {
    console.log(`\n=== Project #${i + 1} ===`);
    console.log(JSON.stringify(row, null, 2));
  });

  db.close();
});
