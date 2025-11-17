const { db } = require('../config/database');

const createSiteLogsTable = () => {
  return new Promise((resolve, reject) => {
    // Check if table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='site_logs'", (err, row) => {
      if (err) {
        console.error('❌ Error checking site_logs table:', err);
        reject(err);
        return;
      }

      if (row) {
        console.log('✅ site_logs table already exists');
        resolve();
        return;
      }

      // Create table
      const createTableQuery = `
        CREATE TABLE site_logs (
          id TEXT PRIMARY KEY,
          project TEXT NOT NULL,
          date DATE NOT NULL,
          images TEXT NOT NULL,
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      db.run(createTableQuery, (err) => {
        if (err) {
          console.error('❌ Error creating site_logs table:', err);
          reject(err);
          return;
        }

        console.log('✅ site_logs table created successfully');

        // Create indexes for better performance
        const createIndexQueries = [
          `CREATE INDEX idx_site_logs_project ON site_logs(project)`,
          `CREATE INDEX idx_site_logs_date ON site_logs(date)`,
          `CREATE INDEX idx_site_logs_project_date ON site_logs(project, date)`
        ];

        let completedIndexes = 0;
        createIndexQueries.forEach(query => {
          db.run(query, (err) => {
            if (err) {
              console.error('❌ Error creating index:', err);
            } else {
              console.log('✅ Index created successfully');
            }
            completedIndexes++;
            if (completedIndexes === createIndexQueries.length) {
              resolve();
            }
          });
        });
      });
    });
  });
};

module.exports = createSiteLogsTable;