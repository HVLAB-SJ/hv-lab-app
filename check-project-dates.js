const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking project dates in database...\n');

db.all(
  `SELECT id, name, start_date, end_date, status FROM projects ORDER BY id DESC LIMIT 10`,
  [],
  (err, rows) => {
    if (err) {
      console.error('Error:', err);
      return;
    }

    console.log(`Total projects found: ${rows.length}`);
    console.log('='.repeat(80));
    rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`Name: ${row.name}`);
      console.log(`Start Date: ${row.start_date}`);
      console.log(`End Date: ${row.end_date}`);
      console.log(`Status: ${row.status}`);
      console.log('-'.repeat(80));
    });

    db.close();
  }
);
