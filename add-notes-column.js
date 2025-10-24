const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.run('ALTER TABLE additional_works ADD COLUMN notes TEXT', (err) => {
  if (err && !err.message.includes('duplicate column')) {
    console.error('Error adding notes column:', err);
  } else {
    console.log('Successfully added notes column to additional_works table');
  }
  db.close();
});
