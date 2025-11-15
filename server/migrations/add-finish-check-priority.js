// Migration: Add is_priority column to finish_check_items table
const { db } = require('../config/database');

const addFinishCheckPriority = () => {
  return new Promise((resolve, reject) => {
    console.log('[Migration] Checking for is_priority column in finish_check_items table...');

    // Check if column already exists
    db.all(`PRAGMA table_info(finish_check_items)`, (err, columns) => {
      if (err) {
        console.error('[Migration] Error checking table schema:', err);
        return reject(err);
      }

      const hasPriorityColumn = columns.some(col => col.name === 'is_priority');

      if (hasPriorityColumn) {
        console.log('[Migration] ✅ is_priority column already exists');
        return resolve();
      }

      // Add the column
      console.log('[Migration] Adding is_priority column...');
      db.run(`ALTER TABLE finish_check_items ADD COLUMN is_priority INTEGER DEFAULT 0`, (err) => {
        if (err) {
          console.error('[Migration] ❌ Error adding is_priority column:', err.message);
          return reject(err);
        }

        console.log('[Migration] ✅ Successfully added is_priority column to finish_check_items table');
        resolve();
      });
    });
  });
};

module.exports = { addFinishCheckPriority };
