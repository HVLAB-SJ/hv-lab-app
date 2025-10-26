const { db } = require('../config/database');

async function createQuoteInquiriesTable() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS quote_inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        address TEXT,
        project_type TEXT,
        budget TEXT,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('❌ Failed to create quote_inquiries table:', err);
        reject(err);
      } else {
        console.log('✅ quote_inquiries table created successfully');
        resolve();
      }
    });
  });
}

module.exports = createQuoteInquiriesTable;
