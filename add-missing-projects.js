const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

const projects = [
  { id: 2, name: '스타벅스 리모델링', client: '스타벅스코리아', address: '서울시 강남구', start_date: '2025-01-15', end_date: '2025-02-15', color: '#00704A' },
  { id: 3, name: '삼성 디지털프라자', client: '삼성전자', address: '서울시 서초구', start_date: '2025-02-01', end_date: '2025-03-01', color: '#1428A0' },
  { id: 4, name: 'CU 편의점 신규', client: 'BGF리테일', address: '서울시 마포구', start_date: '2025-01-20', end_date: '2025-02-20', color: '#651E98' },
  { id: 5, name: '네이버 사옥 리노베이션', client: '네이버', address: '성남시 분당구', start_date: '2025-03-01', end_date: '2025-04-30', color: '#03C75A' },
  { id: 6, name: '현대백화점 VIP라운지', client: '현대백화점', address: '서울시 중구', start_date: '2025-02-15', end_date: '2025-03-31', color: '#000000' }
];

console.log('Adding missing projects to database...\n');

let completed = 0;
projects.forEach(project => {
  db.run(
    `INSERT OR IGNORE INTO projects (id, name, client, address, start_date, end_date, color, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`,
    [project.id, project.name, project.client, project.address, project.start_date, project.end_date, project.color],
    function(err) {
      if (err) {
        console.error(`❌ Error adding project ${project.name}:`, err.message);
      } else if (this.changes > 0) {
        console.log(`✅ Added project: ${project.name} (ID: ${project.id})`);
      } else {
        console.log(`⏭️  Project already exists: ${project.name} (ID: ${project.id})`);
      }

      completed++;
      if (completed === projects.length) {
        console.log('\n=== Verifying all projects ===');
        db.all('SELECT id, name FROM projects ORDER BY id', [], (err, rows) => {
          if (err) {
            console.error('Error fetching projects:', err);
          } else {
            console.log('\nAll projects in database:');
            rows.forEach(p => {
              console.log(`  ID: ${p.id}, Name: ${p.name}`);
            });
          }
          db.close();
        });
      }
    }
  );
});