/**
 * 견적문의 사용자별 읽음 상태 테이블 생성
 * 각 사용자마다 개별적으로 읽음 상태를 관리
 */

const { db } = require('../config/database');

async function migrate() {
  return new Promise((resolve, reject) => {
    // 사용자별 읽음 상태 테이블 생성
    db.run(`
      CREATE TABLE IF NOT EXISTS quote_inquiry_reads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_inquiry_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quote_inquiry_id) REFERENCES quote_inquiries(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(quote_inquiry_id, user_id)
      )
    `, (err) => {
      if (err) {
        console.error('❌ quote_inquiry_reads 테이블 생성 실패:', err);
        reject(err);
        return;
      }
      console.log('✅ quote_inquiry_reads 테이블 생성 완료');

      // 인덱스 생성
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_quote_inquiry_reads_user
        ON quote_inquiry_reads(user_id)
      `, (err) => {
        if (err) {
          console.error('❌ 인덱스 생성 실패:', err);
        } else {
          console.log('✅ quote_inquiry_reads 인덱스 생성 완료');
        }
        resolve();
      });
    });
  });
}

module.exports = { migrate };
