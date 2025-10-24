const { db } = require('./server/config/database');

console.log('🔍 협력업체 이름 데이터 확인 중...\n');

db.all('SELECT id, name, contact_person, position FROM contractors ORDER BY id LIMIT 20', [], (err, contractors) => {
  if (err) {
    console.error('❌ 조회 실패:', err);
    db.close();
    return;
  }

  console.log('현재 협력업체 데이터 (처음 20개):');
  console.log('='.repeat(80));
  contractors.forEach(c => {
    console.log(`ID: ${c.id}`);
    console.log(`  업체명: ${c.name}`);
    console.log(`  담당자: ${c.contact_person || '(없음)'}`);
    console.log(`  직책: ${c.position || '(없음)'}`);
    console.log('-'.repeat(80));
  });

  db.close();
});
