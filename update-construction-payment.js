// Safe update script for construction_payments table
// This script updates the construction payment for 올바른 필라테스 project
// It can be run locally or on Railway using: railway run node update-construction-payment.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use the same database path logic as the main application
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.db');
console.log('Using database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Connected to database');
  }
});

// First, find the project ID for 올바른 필라테스
db.get('SELECT id, name FROM projects WHERE name = ?', ['올바른 필라테스'], (err, project) => {
  if (err) {
    console.error('❌ Error finding project:', err);
    db.close();
    process.exit(1);
  }

  if (!project) {
    console.error('❌ Project "올바른 필라테스" not found');
    db.close();
    process.exit(1);
  }

  console.log(`✅ Found project: ${project.name} (ID: ${project.id})`);

  // Check if a construction payment already exists
  db.get('SELECT * FROM construction_payments WHERE project_id = ?', [project.id], (err, payment) => {
    if (err) {
      console.error('❌ Error checking payment:', err);
      db.close();
      process.exit(1);
    }

    if (payment) {
      // Update existing payment
      console.log('📝 Updating existing payment record...');

      // Define the payment data
      const paymentData = {
        amount: 8000000, // Example amount - adjust as needed
        vat_type: 'percentage',
        vat_percentage: 100,
        vat_amount: 0,
        payments: JSON.stringify([
          {
            date: '2024-01-15',
            amount: 3000000,
            note: '계약금'
          },
          {
            date: '2024-02-01',
            amount: 2500000,
            note: '중도금'
          },
          {
            date: '2024-02-28',
            amount: 2500000,
            note: '잔금'
          }
        ])
      };

      db.run(
        `UPDATE construction_payments
         SET amount = ?, vat_type = ?, vat_percentage = ?, vat_amount = ?, payments = ?
         WHERE project_id = ?`,
        [paymentData.amount, paymentData.vat_type, paymentData.vat_percentage,
         paymentData.vat_amount, paymentData.payments, project.id],
        function(err) {
          if (err) {
            console.error('❌ Error updating payment:', err);
            db.close();
            process.exit(1);
          } else {
            console.log(`✅ Updated payment for project ID ${project.id}`);
            console.log(`   Total amount: ${paymentData.amount.toLocaleString()}원`);

            // Verify the update
            db.get('SELECT * FROM construction_payments WHERE project_id = ?', [project.id], (err, updated) => {
              if (!err && updated) {
                console.log('✅ Verification: Payment record exists with amount:', updated.amount);
              }
              db.close(() => {
                console.log('✅ Database connection closed');
                console.log('✅ Construction payment update completed successfully!');
              });
            });
          }
        }
      );
    } else {
      // Insert new payment
      console.log('📝 Creating new payment record...');

      const paymentData = {
        amount: 8000000, // Example amount - adjust as needed
        vat_type: 'percentage',
        vat_percentage: 100,
        vat_amount: 0,
        payments: JSON.stringify([
          {
            date: '2024-01-15',
            amount: 3000000,
            note: '계약금'
          },
          {
            date: '2024-02-01',
            amount: 2500000,
            note: '중도금'
          },
          {
            date: '2024-02-28',
            amount: 2500000,
            note: '잔금'
          }
        ])
      };

      db.run(
        `INSERT INTO construction_payments
         (project_id, amount, vat_type, vat_percentage, vat_amount, payments)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [project.id, paymentData.amount, paymentData.vat_type, paymentData.vat_percentage,
         paymentData.vat_amount, paymentData.payments],
        function(err) {
          if (err) {
            console.error('❌ Error inserting payment:', err);
            db.close();
            process.exit(1);
          } else {
            console.log(`✅ Created payment for project ID ${project.id} (Payment ID: ${this.lastID})`);
            console.log(`   Total amount: ${paymentData.amount.toLocaleString()}원`);

            // Verify the insert
            db.get('SELECT * FROM construction_payments WHERE id = ?', [this.lastID], (err, inserted) => {
              if (!err && inserted) {
                console.log('✅ Verification: Payment record created with amount:', inserted.amount);
              }
              db.close(() => {
                console.log('✅ Database connection closed');
                console.log('✅ Construction payment creation completed successfully!');
              });
            });
          }
        }
      );
    }
  });
});