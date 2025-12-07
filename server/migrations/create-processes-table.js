const { db } = require('../config/database');

// 기본 공정 목록
const DEFAULT_PROCESSES = [
  '현장점검', '가설', '철거', '방수', '단열', '설비', '전기배선', '인터넷선',
  '에어컨배관', '전열교환기', '소방', '창호', '현관문교체', '목공', '조명타공',
  '금속', '타일', '도장', '마루', '필름', '도배', '중문', '가구', '상판',
  '욕실집기', '조명', '이노솔', '유리', '실리콘', '도어락', '커튼/블라인드',
  '청소', '마감', '준공검사', '가전입고', '스타일링', '촬영', '이사', '기타'
];

const createProcessesTable = () => {
  return new Promise((resolve, reject) => {
    console.log('🔄 공정 테이블 생성 중...');

    db.run(`
      CREATE TABLE IF NOT EXISTS processes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('❌ 공정 테이블 생성 오류:', err.message);
        reject(err);
        return;
      }

      console.log('✅ 공정 테이블 생성 완료');

      // 기본 공정 데이터 삽입 (테이블이 비어있을 경우에만)
      db.get('SELECT COUNT(*) as count FROM processes', [], (err, row) => {
        if (err) {
          console.error('❌ 공정 데이터 확인 오류:', err.message);
          reject(err);
          return;
        }

        if (row.count === 0) {
          console.log('📝 기본 공정 데이터 삽입 중...');
          const stmt = db.prepare('INSERT INTO processes (name, sort_order) VALUES (?, ?)');

          DEFAULT_PROCESSES.forEach((name, index) => {
            stmt.run(name, index);
          });

          stmt.finalize((err) => {
            if (err) {
              console.error('❌ 기본 공정 데이터 삽입 오류:', err.message);
              reject(err);
              return;
            }
            console.log(`✅ ${DEFAULT_PROCESSES.length}개의 기본 공정 데이터 삽입 완료`);
            resolve();
          });
        } else {
          console.log(`✅ 이미 ${row.count}개의 공정 데이터가 존재합니다.`);
          resolve();
        }
      });
    });
  });
};

module.exports = createProcessesTable;
