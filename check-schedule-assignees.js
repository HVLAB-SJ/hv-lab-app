const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'railway-database.db');
const db = new sqlite3.Database(dbPath);

console.log('최근 일정과 담당자 확인 중...\n');

db.all(`
  SELECT
    s.id,
    s.title,
    s.start_date,
    GROUP_CONCAT(u.name, ', ') as assignee_names,
    GROUP_CONCAT(u.id, ', ') as assignee_ids
  FROM schedules s
  LEFT JOIN schedule_assignees sa ON s.id = sa.schedule_id
  LEFT JOIN users u ON sa.user_id = u.id
  GROUP BY s.id
  ORDER BY s.start_date DESC
  LIMIT 15
`, [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }

  console.log('📅 최근 일정 15개:\n');
  rows.forEach((row, i) => {
    console.log(`${i + 1}. [ID: ${row.id}] ${row.title}`);
    console.log(`   날짜: ${row.start_date}`);
    console.log(`   담당자: ${row.assignee_names || '(없음)'}`);
    console.log(`   User IDs: ${row.assignee_ids || '(없음)'}`);
    console.log('');
  });

  // Users 테이블 확인
  db.all('SELECT id, username, name FROM users', [], (err, users) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('\n👥 사용자 목록:');
      users.forEach(user => {
        console.log(`  ID ${user.id}: ${user.name} (${user.username})`);
      });
    }

    db.close();
  });
});
