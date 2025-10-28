const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 먼저 상준님 정보 확인
  db.get("SELECT * FROM users WHERE name LIKE '%상준%' OR username LIKE '%상준%'", (err, row) => {
    if (err) {
      console.error('Error finding user:', err);
      return;
    }
    
    if (row) {
      console.log('Found user:', row);
      
      // admin으로 업데이트
      db.run("UPDATE users SET role = 'admin' WHERE id = ?", [row.id], function(err) {
        if (err) {
          console.error('Error updating user:', err);
          return;
        }
        console.log(`✅ Successfully updated user to admin role`);
        
        // 업데이트된 정보 확인
        db.get("SELECT * FROM users WHERE id = ?", [row.id], (err, updated) => {
          if (err) {
            console.error('Error checking updated user:', err);
            return;
          }
          console.log('Updated user:', updated);
          db.close();
        });
      });
    } else {
      console.log('User not found');
      db.close();
    }
  });
});
