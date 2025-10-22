/**
 * Update user names to remove surnames
 *
 * Changes:
 * - 김상준 → 상준
 * - 이신애 → 신애
 * - 정재천 → 재천
 * - 김민기 → 민기
 * - 박재성 → 재성
 * - 박재현 → 재현
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.db');

const db = new sqlite3.Database(DB_PATH);

const updates = [
  ['상준', '상준'],
  ['신애', '신애'],
  ['재천', '재천'],
  ['민기', '민기'],
  ['재성', '재성'],
  ['재현', '재현']
];

console.log('📝 사용자 이름 업데이트 시작...\n');

let updateCount = 0;

updates.forEach(([username, newName]) => {
  db.run(
    'UPDATE users SET name = ? WHERE username = ?',
    [newName, username],
    function(err) {
      if (err) {
        console.error(`❌ ${username} 업데이트 실패:`, err.message);
      } else if (this.changes > 0) {
        console.log(`✅ ${username}: 이름 업데이트 완료 → ${newName}`);
        updateCount++;
      } else {
        console.log(`⚠️  ${username}: 사용자를 찾을 수 없음`);
      }

      // Last update
      if (username === '재현') {
        console.log(`\n✨ 업데이트 완료! (${updateCount}명 변경됨)`);

        // Verify
        db.all('SELECT username, name FROM users', [], (err, rows) => {
          if (!err) {
            console.log('\n현재 사용자 목록:');
            rows.forEach(row => {
              console.log(`  ${row.username}: ${row.name}`);
            });
          }
          db.close();
        });
      }
    }
  );
});
