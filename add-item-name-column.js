const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('Adding item_name column to payment_requests table...');

db.run(
  `ALTER TABLE payment_requests ADD COLUMN item_name TEXT`,
  (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ item_name column already exists');
      } else {
        console.error('✗ Error adding column:', err.message);
      }
    } else {
      console.log('✓ Successfully added item_name column');
    }

    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
  }
);
