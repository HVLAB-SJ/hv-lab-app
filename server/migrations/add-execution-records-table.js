// execution_records 테이블 추가 마이그레이션
module.exports = function addExecutionRecordsTable(db) {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS execution_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        project_name TEXT NOT NULL,
        author TEXT,
        date TEXT NOT NULL,
        process TEXT,
        item_name TEXT NOT NULL,
        material_cost INTEGER DEFAULT 0,
        labor_cost INTEGER DEFAULT 0,
        vat_amount INTEGER DEFAULT 0,
        total_amount INTEGER DEFAULT 0,
        notes TEXT,
        payment_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (payment_id) REFERENCES payment_requests(id)
      )
    `, function(err) {
      if (err) {
        console.error('execution_records 테이블 생성 실패:', err);
        reject(err);
      } else {
        console.log('execution_records 테이블 생성 완료');
        resolve();
      }
    });
  });
};
