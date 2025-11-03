const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 스펙북 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS specbook_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('스펙북 테이블 생성 실패:', err);
    } else {
      console.log('✅ 스펙북 테이블 생성 완료');
    }
  });

  // 샘플 데이터 추가
  const sampleData = [
    { name: '핸들 1', category: '주방', description: '주방용 핸들' },
    { name: '물건이용뿜 무릎 나눔', category: '욕실/세면대', description: '욕실용 수전' },
    { name: '무릎 나눔 내부역정 분담', category: '주방', description: '주방용 수전' },
    { name: '욕실장 0600', category: '욕실/세면대', description: '욕실장' }
  ];

  const stmt = db.prepare(`
    INSERT INTO specbook_items (name, category, description)
    VALUES (?, ?, ?)
  `);

  sampleData.forEach(item => {
    stmt.run(item.name, item.category, item.description);
  });

  stmt.finalize(() => {
    console.log('✅ 샘플 데이터 추가 완료');
    db.close();
  });
});
