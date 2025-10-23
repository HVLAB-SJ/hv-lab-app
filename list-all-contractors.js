const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

db.all('SELECT name, contact_person, specialty, phone FROM contractors ORDER BY id', [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`전체 협력업체 목록 (${rows.length}개):\n`);
    rows.forEach((r, i) => {
      const num = (i + 1).toString().padStart(3);
      const phone = r.phone || '전화번호 없음';
      console.log(`${num}. ${r.name} - ${r.contact_person} - ${r.specialty} - ${phone}`);
    });

    // 공정별 통계
    console.log('\n\n공정별 통계:');
    const specialtyCounts = {};
    rows.forEach(r => {
      specialtyCounts[r.specialty] = (specialtyCounts[r.specialty] || 0) + 1;
    });
    Object.entries(specialtyCounts).sort((a, b) => b[1] - a[1]).forEach(([specialty, count]) => {
      console.log(`  ${specialty}: ${count}개`);
    });
  }
  db.close();
});
