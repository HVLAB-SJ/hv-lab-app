const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'construction_schedule.db');
const db = new sqlite3.Database(dbPath);

console.log('Adding time column to schedules table...');

db.run(`ALTER TABLE schedules ADD COLUMN time TEXT DEFAULT '-'`, (err) => {
  if (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('✅ Column "time" already exists');
    } else {
      console.error('❌ Error adding time column:', err.message);
    }
  } else {
    console.log('✅ Successfully added time column to schedules table');
  }

  // Verify the column was added
  db.all(`PRAGMA table_info(schedules)`, (err, columns) => {
    if (err) {
      console.error('Error checking table schema:', err);
    } else {
      console.log('\nSchedules table columns:');
      columns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
      });

      const hasTimeColumn = columns.some(col => col.name === 'time');
      if (hasTimeColumn) {
        console.log('\n✅ Time column is present in the table');
      } else {
        console.log('\n❌ Time column is NOT present in the table');
      }
    }

    db.close();
  });
});
