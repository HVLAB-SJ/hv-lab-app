// This script updates user names in Railway database to remove surnames
// Run this ONCE on Railway to fix existing data

const sqlite3 = require('sqlite3').verbose();

// Use Railway's database path if DATABASE_PATH env var is set
const dbPath = process.env.DATABASE_PATH || 'database.db';
const db = new sqlite3.Database(dbPath);

const userUpdates = [
  { username: '상준', newName: '상준' },  // Was: 김상준
  { username: '신애', newName: '신애' },  // Was: 이신애 or 박신애
  { username: '재천', newName: '재천' },  // Was: 정재천 or 이재천
  { username: '민기', newName: '민기' },  // Was: 김민기 or 최민기
  { username: '재성', newName: '재성' },  // Was: 박재성 or 정재성
  { username: '재현', newName: '재현' }   // Was: 박재현 or 김재현
];

console.log('Updating user names in Railway database...\n');

db.serialize(() => {
  // First, show current names
  db.all('SELECT username, name FROM users ORDER BY id', [], (err, rows) => {
    if (err) {
      console.error('Error reading users:', err);
      return;
    }

    console.log('BEFORE:');
    rows.forEach(r => console.log(`  ${r.username}: "${r.name}"`));
    console.log('');

    // Update each user
    let completed = 0;
    userUpdates.forEach(({ username, newName }) => {
      db.run(
        'UPDATE users SET name = ? WHERE username = ?',
        [newName, username],
        function(err) {
          if (err) {
            console.error(`Error updating ${username}:`, err);
          } else {
            console.log(`✓ Updated ${username} -> name = "${newName}" (${this.changes} rows)`);
          }

          completed++;
          if (completed === userUpdates.length) {
            // Show final result
            db.all('SELECT username, name FROM users ORDER BY id', [], (err, rows) => {
              if (!err) {
                console.log('\nAFTER:');
                rows.forEach(r => console.log(`  ${r.username}: "${r.name}"`));
              }
              db.close();
              console.log('\n✅ Database update complete!');
            });
          }
        }
      );
    });
  });
});
