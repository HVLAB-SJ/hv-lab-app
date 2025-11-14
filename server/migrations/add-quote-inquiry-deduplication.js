const { db } = require('../config/database');

/**
 * 견적문의 중복 방지를 위한 컬럼 추가
 * - email_message_id: 이메일 메시지 ID (UNIQUE)
 * - content_hash: 메시지 내용 해시 (UNIQUE)
 */
async function addQuoteInquiryDeduplication() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 이메일 메시지 ID 컬럼 추가
      db.run(`
        ALTER TABLE quote_inquiries
        ADD COLUMN email_message_id TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('❌ Failed to add email_message_id column:', err);
        } else {
          console.log('✅ email_message_id column added successfully');
        }
      });

      // 콘텐츠 해시 컬럼 추가
      db.run(`
        ALTER TABLE quote_inquiries
        ADD COLUMN content_hash TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('❌ Failed to add content_hash column:', err);
        } else {
          console.log('✅ content_hash column added successfully');
        }
      });

      // email_message_id에 UNIQUE 인덱스 생성
      db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_inquiries_email_message_id
        ON quote_inquiries(email_message_id)
        WHERE email_message_id IS NOT NULL
      `, (err) => {
        if (err) {
          console.error('❌ Failed to create email_message_id unique index:', err);
        } else {
          console.log('✅ email_message_id unique index created successfully');
        }
      });

      // content_hash에 UNIQUE 인덱스 생성
      db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_inquiries_content_hash
        ON quote_inquiries(content_hash)
        WHERE content_hash IS NOT NULL
      `, (err) => {
        if (err) {
          console.error('❌ Failed to create content_hash unique index:', err);
          reject(err);
        } else {
          console.log('✅ content_hash unique index created successfully');
          console.log('🎉 견적문의 중복 방지 설정 완료');
          resolve();
        }
      });
    });
  });
}

module.exports = addQuoteInquiryDeduplication;
