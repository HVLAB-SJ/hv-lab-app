const { db } = require('../config/database');

async function addExpectedPaymentDates() {
  return new Promise((resolve, reject) => {
    db.run(
      `ALTER TABLE construction_payments ADD COLUMN expected_payment_dates TEXT`,
      [],
      (err) => {
        if (err) {
          // Check if column already exists
          if (err.message.includes('duplicate column name')) {
            console.log('✓ expected_payment_dates column already exists');
            resolve();
          } else {
            console.error('Error adding expected_payment_dates column:', err);
            reject(err);
          }
        } else {
          console.log('✓ Successfully added expected_payment_dates column to construction_payments');
          resolve();
        }
      }
    );
  });
}

module.exports = { addExpectedPaymentDates };
