const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function addOriginalMaterialAmount() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database.db');
  const db = new sqlite3.Database(dbPath);

  return new Promise((resolve, reject) => {
    db.run(`
      ALTER TABLE payment_requests
      ADD COLUMN original_material_amount INTEGER DEFAULT 0
    `, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log('✅ original_material_amount column already exists');
          resolve();
        } else {
          console.error('❌ Error adding original_material_amount column:', err);
          reject(err);
        }
      } else {
        console.log('✅ Successfully added original_material_amount column');
        resolve();
      }
      db.close();
    });
  });
}

module.exports = addOriginalMaterialAmount;

// Run if called directly
if (require.main === module) {
  addOriginalMaterialAmount()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}