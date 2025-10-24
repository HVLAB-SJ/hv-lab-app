// Migration: Add time column to schedules table
const { db } = require('../config/database');

const addTimeColumn = () => {
  return new Promise((resolve, reject) => {
    console.log('[Migration] Checking for time column in schedules table...');

    // Check if column already exists
    db.all(`PRAGMA table_info(schedules)`, (err, columns) => {
      if (err) {
        console.error('[Migration] Error checking table schema:', err);
        return reject(err);
      }

      const hasTimeColumn = columns.some(col => col.name === 'time');

      if (hasTimeColumn) {
        console.log('[Migration] ✅ Time column already exists');
        return resolve();
      }

      // Add the column
      console.log('[Migration] Adding time column...');
      db.run(`ALTER TABLE schedules ADD COLUMN time TEXT DEFAULT '-'`, (err) => {
        if (err) {
          console.error('[Migration] ❌ Error adding time column:', err.message);
          return reject(err);
        }

        console.log('[Migration] ✅ Successfully added time column to schedules table');
        resolve();
      });
    });
  });
};

module.exports = { addTimeColumn };
