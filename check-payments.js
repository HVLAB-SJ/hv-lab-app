const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

const query = `
  SELECT pr.*,
         u.username as requester_name,
         p.name as project_name,
         p.color as project_color,
         a.username as approver_name
  FROM payment_requests pr
  LEFT JOIN users u ON pr.user_id = u.id
  LEFT JOIN projects p ON pr.project_id = p.id
  LEFT JOIN users a ON pr.approved_by = a.id
  ORDER BY pr.created_at DESC
  LIMIT 3
`;

db.all(query, [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }

  console.log('Found', rows.length, 'payment requests');
  console.log('\nSample data:');
  rows.forEach((row, i) => {
    console.log(`\n=== Payment #${i + 1} ===`);
    console.log(JSON.stringify(row, null, 2));
  });

  db.close();
});
