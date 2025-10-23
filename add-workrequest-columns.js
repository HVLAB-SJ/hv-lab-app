const { db } = require('./server/config/database');

console.log('Adding columns to work_requests table...');

// Add project column
db.run('ALTER TABLE work_requests ADD COLUMN project TEXT', (err) => {
  if (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('✓ project column already exists');
    } else {
      console.error('Error adding project column:', err);
    }
  } else {
    console.log('✓ Added project column');
  }

  // Add request_date column
  db.run('ALTER TABLE work_requests ADD COLUMN request_date DATE', (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ request_date column already exists');
      } else {
        console.error('Error adding request_date column:', err);
      }
    } else {
      console.log('✓ Added request_date column');
    }

    // Add request_type column
    db.run('ALTER TABLE work_requests ADD COLUMN request_type TEXT', (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log('✓ request_type column already exists');
        } else {
          console.error('Error adding request_type column:', err);
        }
      } else {
        console.log('✓ Added request_type column');
      }

      // Add requested_by column
      db.run('ALTER TABLE work_requests ADD COLUMN requested_by TEXT', (err) => {
        if (err) {
          if (err.message.includes('duplicate column name')) {
            console.log('✓ requested_by column already exists');
          } else {
            console.error('Error adding requested_by column:', err);
          }
        } else {
          console.log('✓ Added requested_by column');
        }

        // Verify the schema
        db.all("PRAGMA table_info(work_requests)", (err, rows) => {
          if (err) {
            console.error('Error reading schema:', err);
          } else {
            console.log('\nwork_requests table schema:');
            rows.forEach(row => {
              console.log(`  ${row.name} (${row.type})`);
            });
          }
          process.exit(0);
        });
      });
    });
  });
});
