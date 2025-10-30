const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking construction payments...\n');

// Check total count
db.get('SELECT COUNT(*) as count FROM construction_payments', [], (err, row) => {
  if (err) {
    console.error('Error counting construction payments:', err);
    return;
  }
  console.log('Total construction payments:', row.count);
});

// Check construction payments with project info
db.all(`
  SELECT cp.id, cp.project_id, cp.amount, cp.vat_type, cp.vat_percentage, cp.vat_amount,
         cp.payments, p.name as project_name, p.client
  FROM construction_payments cp
  LEFT JOIN projects p ON cp.project_id = p.id
  ORDER BY cp.created_at DESC
`, [], (err, rows) => {
  if (err) {
    console.error('Error fetching construction payments:', err);
    return;
  }

  console.log('\nConstruction Payments:');
  console.log('='.repeat(80));
  rows.forEach(row => {
    console.log(`ID: ${row.id}`);
    console.log(`Project ID: ${row.project_id}`);
    console.log(`Project Name: ${row.project_name || 'NULL'}`);
    console.log(`Client: ${row.client || 'NULL'}`);
    console.log(`Amount: ${row.amount}`);
    console.log(`VAT Type: ${row.vat_type}`);
    console.log(`VAT Percentage: ${row.vat_percentage}`);
    console.log(`VAT Amount: ${row.vat_amount}`);
    console.log(`Payments: ${row.payments || 'NULL'}`);
    console.log('-'.repeat(80));
  });

  db.close();
});
