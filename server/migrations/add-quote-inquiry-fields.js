const { db } = require('../config/database');

async function addQuoteInquiryFields() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 첨부파일 관련 필드 추가
      db.run(`
        ALTER TABLE quote_inquiries
        ADD COLUMN attachments TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('❌ Failed to add attachments column:', err);
        } else {
          console.log('✅ attachments column added successfully');
        }
      });

      // 샷시 공사 여부
      db.run(`
        ALTER TABLE quote_inquiries
        ADD COLUMN sash_work TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('❌ Failed to add sash_work column:', err);
        } else {
          console.log('✅ sash_work column added successfully');
        }
      });

      // 확장 공사 여부
      db.run(`
        ALTER TABLE quote_inquiries
        ADD COLUMN extension_work TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('❌ Failed to add extension_work column:', err);
        } else {
          console.log('✅ extension_work column added successfully');
        }
      });

      // 시공 희망 시기
      db.run(`
        ALTER TABLE quote_inquiries
        ADD COLUMN preferred_date TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('❌ Failed to add preferred_date column:', err);
        } else {
          console.log('✅ preferred_date column added successfully');
        }
      });

      // 평수
      db.run(`
        ALTER TABLE quote_inquiries
        ADD COLUMN area_size TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('❌ Failed to add area_size column:', err);
          reject(err);
        } else {
          console.log('✅ area_size column added successfully');
          resolve();
        }
      });
    });
  });
}

module.exports = addQuoteInquiryFields;
