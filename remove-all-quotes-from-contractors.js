const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('Starting to remove all quotes from contractors table...');

// First, check current data
db.all(`
  SELECT id, name, contact_person, specialty
  FROM contractors
  WHERE name LIKE '%"%'
     OR contact_person LIKE '%"%'
     OR phone LIKE '%"%'
     OR email LIKE '%"%'
     OR specialty LIKE '%"%'
     OR notes LIKE '%"%'
     OR bank_name LIKE '%"%'
     OR account_number LIKE '%"%'
     OR rank LIKE '%"%'
     OR position LIKE '%"%'
`, [], (err, rows) => {
  if (err) {
    console.error('Error fetching contractors:', err);
    db.close();
    return;
  }

  console.log(`Found ${rows.length} contractors with quotes:`);
  rows.forEach(row => {
    console.log(`  ID ${row.id}: ${row.name} - Contact: "${row.contact_person || 'N/A'}" - Specialty: "${row.specialty || 'N/A'}"`);
  });

  if (rows.length === 0) {
    console.log('No quotes found in contractors table.');
    db.close();
    return;
  }

  // Update all rows to remove quotes from all fields
  db.run(`
    UPDATE contractors SET
      name = REPLACE(name, '"', ''),
      contact_person = REPLACE(contact_person, '"', ''),
      phone = REPLACE(phone, '"', ''),
      email = REPLACE(email, '"', ''),
      specialty = REPLACE(specialty, '"', ''),
      notes = REPLACE(notes, '"', ''),
      bank_name = REPLACE(bank_name, '"', ''),
      account_number = REPLACE(account_number, '"', ''),
      rank = REPLACE(rank, '"', ''),
      position = REPLACE(position, '"', '')
    WHERE name LIKE '%"%'
       OR contact_person LIKE '%"%'
       OR phone LIKE '%"%'
       OR email LIKE '%"%'
       OR specialty LIKE '%"%'
       OR notes LIKE '%"%'
       OR bank_name LIKE '%"%'
       OR account_number LIKE '%"%'
       OR rank LIKE '%"%'
       OR position LIKE '%"%'
  `, function(err) {
    if (err) {
      console.error('Error updating contractors:', err);
    } else {
      console.log(`\n✓ Successfully cleaned quotes from ${this.changes} contractor entries!`);
    }
    db.close();
  });
});
