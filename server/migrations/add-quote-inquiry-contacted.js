const { db } = require('../config/database');

async function addQuoteInquiryContacted() {
  return new Promise((resolve, reject) => {
    console.log('Adding is_contacted column to quote_inquiries table...');

    // Check if column already exists
    db.get("PRAGMA table_info(quote_inquiries)", [], (err, info) => {
      if (err) {
        console.error('Error checking table info:', err);
        return reject(err);
      }

      // Add is_contacted column
      db.run(
        `ALTER TABLE quote_inquiries ADD COLUMN is_contacted INTEGER DEFAULT 0`,
        [],
        (err) => {
          if (err) {
            if (err.message.includes('duplicate column name')) {
              console.log('is_contacted column already exists');
              resolve();
            } else {
              console.error('Error adding is_contacted column:', err);
              reject(err);
            }
          } else {
            console.log('Successfully added is_contacted column');
            resolve();
          }
        }
      );
    });
  });
}

module.exports = addQuoteInquiryContacted;
