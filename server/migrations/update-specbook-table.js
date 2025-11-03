const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 기존 테이블 삭제
  db.run('DROP TABLE IF EXISTS specbook_items', (err) => {
    if (err) {
      console.error('기존 테이블 삭제 실패:', err);
      return;
    }
    console.log('✅ 기존 스펙북 테이블 삭제 완료');

    // 새 스펙북 테이블 생성
    db.run(`
      CREATE TABLE specbook_items (
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
        console.error('스펙북 테이블 생성 실패:', err);
      } else {
        console.log('✅ 스펙북 테이블 생성 완료');
      }
      db.close();
    });
  });
});
