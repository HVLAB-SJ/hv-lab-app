const { db } = require('../config/database');

async function addKakaoPayFields() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // kakaopay_tid 컬럼 추가
      db.run(`
        ALTER TABLE payment_requests ADD COLUMN kakaopay_tid TEXT;
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding kakaopay_tid column:', err);
        } else {
          console.log('kakaopay_tid column added or already exists');
        }
      });

      // kakaopay_redirect_url 컬럼 추가
      db.run(`
        ALTER TABLE payment_requests ADD COLUMN kakaopay_redirect_url TEXT;
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding kakaopay_redirect_url column:', err);
        } else {
          console.log('kakaopay_redirect_url column added or already exists');
        }
      });

      // kakaopay_approved_at 컬럼 추가
      db.run(`
        ALTER TABLE payment_requests ADD COLUMN kakaopay_approved_at TEXT;
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding kakaopay_approved_at column:', err);
          reject(err);
        } else {
          console.log('kakaopay_approved_at column added or already exists');
          resolve();
        }
      });
    });
  });
}

module.exports = addKakaoPayFields;
