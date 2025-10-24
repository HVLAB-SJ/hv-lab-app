-- 오픈뱅킹 토큰 저장 테이블
CREATE TABLE IF NOT EXISTS banking_tokens (
  user_id INTEGER PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  scope TEXT,
  token_type TEXT,
  expires_at DATETIME,
  user_seq_no TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 송금 거래 내역 테이블
CREATE TABLE IF NOT EXISTS banking_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  transaction_id TEXT NOT NULL UNIQUE,
  bank_code TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payment_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_banking_tokens_expires ON banking_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_payment ON banking_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_user ON banking_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_banking_transactions_created ON banking_transactions(created_at DESC);
