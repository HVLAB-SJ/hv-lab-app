const { db } = require('../config/database');

/**
 * KB 은행 OAuth 토큰을 저장할 테이블 생성
 */
async function createKBBankingTokensTable() {
  return new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS kb_banking_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        scope TEXT,
        token_type TEXT,
        expires_at DATETIME,
        user_seq_no TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      (err) => {
        if (err) {
          console.error('❌ KB banking tokens 테이블 생성 실패:', err);
          reject(err);
        } else {
          console.log('✅ KB banking tokens 테이블 생성 완료');
          resolve();
        }
      }
    );
  });
}

module.exports = createKBBankingTokensTable;