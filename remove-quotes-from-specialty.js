const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('Starting to remove quotes from specialty field...');

// First, check current data
db.all('SELECT id, name, specialty FROM contractors WHERE specialty LIKE \'%"%\'', [], (err, rows) => {
  if (err) {
    console.error('Error fetching contractors:', err);
    db.close();
    return;
  }

  console.log(`Found ${rows.length} contractors with quotes in specialty field:`);
  rows.forEach(row => {
    console.log(`  ID ${row.id}: ${row.name} - "${row.specialty}"`);
  });

  if (rows.length === 0) {
    console.log('No quotes found in specialty field.');
    db.close();
    return;
  }

  // Update each row to remove quotes
  let updated = 0;
  rows.forEach((row, index) => {
    const cleanedSpecialty = row.specialty.replace(/"/g, '');

    db.run(
      'UPDATE contractors SET specialty = ? WHERE id = ?',
      [cleanedSpecialty, row.id],
      (err) => {
        if (err) {
          console.error(`Error updating contractor ${row.id}:`, err);
        } else {
          console.log(`✓ Updated ID ${row.id}: "${row.specialty}" → "${cleanedSpecialty}"`);
          updated++;
        }

        // Close database after last update
        if (index === rows.length - 1) {
          console.log(`\nCompleted! Updated ${updated} out of ${rows.length} contractors.`);
          db.close();
        }
      }
    );
  });
});
