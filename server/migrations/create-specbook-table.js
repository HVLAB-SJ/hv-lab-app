const { db } = require('../config/database');

async function createSpecbookTable() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS specbook_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        brand TEXT,
        price TEXT,
        image_url TEXT,
        project_id INTEGER,
        is_library INTEGER DEFAULT 1,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('❌ 스펙북 테이블 생성 실패:', err);
        reject(err);
      } else {
        console.log('✅ 스펙북 테이블 생성 완료');
        resolve();
      }
    });
  });
}

module.exports = createSpecbookTable;
