const Database = require('better-sqlite3');
const db = new Database('database.db');

// Check projects
console.log('\n=== Projects ===');
const projects = db.prepare('SELECT id, name FROM projects LIMIT 5').all();
projects.forEach(p => console.log(`ID: ${p.id}, Name: ${p.name}`));

// Check if project_id is being sent correctly
console.log('\n=== Testing payment creation with valid project_id ===');
const validProjectId = projects[0]?.id;
console.log('Using project_id:', validProjectId);

// Close database
db.close();