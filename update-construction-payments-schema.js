const { db } = require('./server/config/database');

console.log('🔧 Updating construction_payments table schema...');

// Add new columns to construction_payments table
const queries = [
  // Add VAT type column (percentage or amount)
  `ALTER TABLE construction_payments ADD COLUMN vat_type TEXT DEFAULT 'percentage'`,

  // Add VAT percentage column (0-100)
  `ALTER TABLE construction_payments ADD COLUMN vat_percentage INTEGER DEFAULT 100`,

  // Add VAT amount column (for fixed VAT amount)
  `ALTER TABLE construction_payments ADD COLUMN vat_amount INTEGER DEFAULT 0`,

  // Add payments JSON column (for storing payment history array)
  `ALTER TABLE construction_payments ADD COLUMN payments TEXT DEFAULT '[]'`
];

let completedQueries = 0;

queries.forEach((query, index) => {
  db.run(query, [], function(err) {
    if (err) {
      // Ignore "duplicate column" errors (column already exists)
      if (err.message.includes('duplicate column')) {
        console.log(`⚠️  Column already exists (query ${index + 1}/${queries.length})`);
      } else {
        console.error(`❌ Error executing query ${index + 1}:`, err.message);
        console.error(`   Query: ${query}`);
      }
    } else {
      console.log(`✅ Successfully executed query ${index + 1}/${queries.length}`);
    }

    completedQueries++;

    if (completedQueries === queries.length) {
      console.log('\n✅ Schema update completed!');
      console.log('\nVerifying updated schema...');

      db.all('PRAGMA table_info(construction_payments)', [], (err, rows) => {
        if (err) {
          console.error('❌ Error fetching schema:', err);
        } else {
          console.log('\nCurrent construction_payments schema:');
          rows.forEach(row => {
            console.log(`  - ${row.name}: ${row.type}${row.dflt_value ? ` (default: ${row.dflt_value})` : ''}`);
          });
        }
        db.close();
      });
    }
  });
});
