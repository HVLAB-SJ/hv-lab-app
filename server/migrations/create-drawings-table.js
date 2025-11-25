const { db } = require('../config/database');

const createDrawingsTable = () => {
  return new Promise((resolve, reject) => {
    // Check if table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='drawings'", (err, row) => {
      if (err) {
        console.error('Error checking drawings table:', err);
        reject(err);
        return;
      }

      if (row) {
        console.log('drawings table already exists');
        resolve();
        return;
      }

      // Create table
      const createTableQuery = `
        CREATE TABLE drawings (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          type TEXT NOT NULL,
          image_url TEXT,
          markers TEXT DEFAULT '[]',
          rooms TEXT DEFAULT '[]',
          naver_type_sqm TEXT,
          naver_type_pyeong TEXT,
          naver_area TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, type)
        )
      `;

      db.run(createTableQuery, (err) => {
        if (err) {
          console.error('Error creating drawings table:', err);
          reject(err);
          return;
        }

        console.log('drawings table created successfully');

        // Create indexes for better performance
        const createIndexQueries = [
          `CREATE INDEX idx_drawings_project_id ON drawings(project_id)`,
          `CREATE INDEX idx_drawings_type ON drawings(type)`,
          `CREATE INDEX idx_drawings_project_type ON drawings(project_id, type)`
        ];

        let completedIndexes = 0;
        createIndexQueries.forEach(query => {
          db.run(query, (err) => {
            if (err) {
              console.error('Error creating index:', err);
            } else {
              console.log('Drawings index created successfully');
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

module.exports = createDrawingsTable;
