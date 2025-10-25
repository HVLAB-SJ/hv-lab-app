const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('Adding payment detail columns to payment_requests table...');

const columns = [
  { name: 'material_amount', type: 'INTEGER DEFAULT 0' },
  { name: 'labor_amount', type: 'INTEGER DEFAULT 0' },
  { name: 'original_labor_amount', type: 'INTEGER DEFAULT 0' },
  { name: 'apply_tax_deduction', type: 'INTEGER DEFAULT 0' }, // SQLite uses INTEGER for boolean
  { name: 'includes_vat', type: 'INTEGER DEFAULT 0' }
];

let completed = 0;
let errors = [];

columns.forEach(column => {
  db.run(
    `ALTER TABLE payment_requests ADD COLUMN ${column.name} ${column.type}`,
    (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log(`✓ ${column.name} column already exists`);
        } else {
          console.error(`✗ Error adding ${column.name}:`, err.message);
          errors.push({ column: column.name, error: err.message });
        }
      } else {
        console.log(`✓ Successfully added ${column.name} column`);
      }

      completed++;

      if (completed === columns.length) {
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
          } else {
            console.log('Database connection closed');
            if (errors.length > 0) {
              console.log('\nErrors encountered:');
              errors.forEach(e => console.log(`  - ${e.column}: ${e.error}`));
            } else {
              console.log('\n✓ All columns added successfully!');
            }
          }
        });
      }
    }
  );
});
