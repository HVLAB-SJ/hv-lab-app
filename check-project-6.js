const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('\n=== Checking for Project ID 6 ===');

db.all('SELECT id, name FROM projects ORDER BY id', [], (err, projects) => {
  if (err) {
    console.error('Error fetching projects:', err);
    return;
  }

  console.log('\nAll projects in database:');
  projects.forEach(p => {
    console.log(`  ID: ${p.id}, Name: ${p.name}`);
  });

  const project6 = projects.find(p => p.id === 6);
  if (project6) {
    console.log(`\n✅ Project ID 6 exists: "${project6.name}"`);
  } else {
    console.log('\n❌ Project ID 6 does not exist!');
    console.log('This is why the payment creation fails.');
  }

  db.close();
});