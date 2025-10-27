const { db } = require('../config/database');

async function updateSchedulesProjectNullable() {
  return new Promise((resolve, reject) => {
    console.log('🔄 Updating schedules table to allow NULL project_id...');

    // SQLite doesn't support ALTER COLUMN, so we need to:
    // 1. Create new table with nullable project_id and project_name column
    // 2. Copy data
    // 3. Drop old table
    // 4. Rename new table

    db.serialize(() => {
      // Create new table
      db.run(`
        CREATE TABLE IF NOT EXISTS schedules_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER,
          project_name TEXT,
          title TEXT NOT NULL,
          description TEXT,
          start_date DATETIME NOT NULL,
          end_date DATETIME NOT NULL,
          type TEXT DEFAULT 'construction',
          status TEXT DEFAULT 'pending',
          priority TEXT DEFAULT 'normal',
          color TEXT,
          progress INTEGER DEFAULT 0,
          assigned_to TEXT,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          time TEXT DEFAULT '-',
          FOREIGN KEY (project_id) REFERENCES projects(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Failed to create schedules_new table:', err);
          reject(err);
          return;
        }

        // Copy data from old table
        db.run(`
          INSERT INTO schedules_new
            (id, project_id, title, description, start_date, end_date, type, status, priority, color, progress, assigned_to, created_by, created_at, updated_at, time)
          SELECT
            id, project_id, title, description, start_date, end_date, type, status, priority, color, progress, assigned_to, created_by, created_at, updated_at, time
          FROM schedules
        `, (err) => {
          if (err) {
            console.error('❌ Failed to copy data to schedules_new:', err);
            reject(err);
            return;
          }

          // Drop old table
          db.run('DROP TABLE schedules', (err) => {
            if (err) {
              console.error('❌ Failed to drop old schedules table:', err);
              reject(err);
              return;
            }

            // Rename new table
            db.run('ALTER TABLE schedules_new RENAME TO schedules', (err) => {
              if (err) {
                console.error('❌ Failed to rename schedules_new:', err);
                reject(err);
              } else {
                console.log('✅ schedules table updated successfully - project_id is now nullable and project_name column added');
                resolve();
              }
            });
          });
        });
      });
    });
  });
}

module.exports = updateSchedulesProjectNullable;
