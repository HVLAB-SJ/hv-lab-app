const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.db');
const sqlPath = path.join(__dirname, 'server', 'migrations', 'add_banking_tables.sql');

const db = new sqlite3.Database(dbPath);
const sql = fs.readFileSync(sqlPath, 'utf8');

// SQL을 세미콜론으로 분리하여 실행
const statements = sql.split(';').filter(stmt => stmt.trim());

db.serialize(() => {
  statements.forEach((statement, index) => {
    if (statement.trim()) {
      db.run(statement, (err) => {
        if (err) {
          console.error(`Error executing statement ${index + 1}:`, err);
        } else {
          console.log(`Statement ${index + 1} executed successfully`);
        }
      });
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('\n✓ Banking tables migration completed!');
  }
});
