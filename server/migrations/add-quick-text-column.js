const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function addQuickTextColumn() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database.db');
  const db = new sqlite3.Database(dbPath);

  return new Promise((resolve, reject) => {
    db.run(`
      ALTER TABLE payment_requests
      ADD COLUMN quick_text TEXT
    `, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log('✅ quick_text column already exists');
          resolve();
        } else {
          console.error('❌ Error adding quick_text column:', err);
          reject(err);
        }
      } else {
        console.log('✅ Successfully added quick_text column');
        resolve();
      }
      db.close();
    });
  });
}

module.exports = addQuickTextColumn;

// Run if called directly
if (require.main === module) {
  addQuickTextColumn()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}