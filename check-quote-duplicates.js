const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('데이터베이스 경로:', dbPath);
console.log('\n견적문의 데이터 확인 중...\n');

// 모든 견적문의 조회
db.all(
  `SELECT id, name, phone, email, datetime(created_at) as created
   FROM quote_inquiries
   ORDER BY created_at DESC`,
  [],
  (err, rows) => {
    if (err) {
      console.error('조회 실패:', err);
      db.close();
      return;
    }

    if (!rows || rows.length === 0) {
      console.log('견적문의 데이터가 없습니다.');
      db.close();
      return;
    }

    console.log(`총 ${rows.length}개의 견적문의가 있습니다.\n`);

    // 중복 감지 (이름 + 전화번호 + 이메일이 같은 경우)
    const grouped = {};
    rows.forEach(row => {
      const key = `${row.name}|${row.phone}|${row.email}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(row);
    });

    // 중복된 항목 찾기
    const duplicates = Object.entries(grouped).filter(([key, items]) => items.length > 1);

    if (duplicates.length === 0) {
      console.log('중복된 견적문의가 없습니다.');

      // 전체 목록 출력
      console.log('\n=== 전체 견적문의 목록 ===');
      rows.forEach((row, idx) => {
        console.log(`${idx + 1}. [ID: ${row.id}] ${row.name} | ${row.phone} | ${row.created}`);
      });

      db.close();
      return;
    }

    console.log(`⚠️  ${duplicates.length}개의 중복 그룹을 발견했습니다.\n`);

    // 삭제할 ID 목록
    const idsToDelete = [];

    duplicates.forEach(([key, items], groupIdx) => {
      const [name, phone, email] = key.split('|');
      console.log(`\n=== 중복 그룹 ${groupIdx + 1} ===`);
      console.log(`이름: ${name}`);
      console.log(`전화: ${phone}`);
      console.log(`이메일: ${email}`);
      console.log(`중복 횟수: ${items.length}개\n`);

      // 최신순으로 정렬 (첫 번째 항목만 유지, 나머지 삭제)
      items.sort((a, b) => new Date(b.created) - new Date(a.created));

      items.forEach((item, idx) => {
        if (idx === 0) {
          console.log(`  ✓ [유지] ID: ${item.id} | 등록일: ${item.created}`);
        } else {
          console.log(`  ✗ [삭제] ID: ${item.id} | 등록일: ${item.created}`);
          idsToDelete.push(item.id);
        }
      });
    });

    console.log(`\n\n=== 삭제 요약 ===`);
    console.log(`총 ${idsToDelete.length}개의 중복 항목을 삭제합니다.`);
    console.log(`삭제할 ID: ${idsToDelete.join(', ')}`);

    if (idsToDelete.length === 0) {
      console.log('\n삭제할 항목이 없습니다.');
      db.close();
      return;
    }

    // 삭제 실행
    const placeholders = idsToDelete.map(() => '?').join(',');
    db.run(
      `DELETE FROM quote_inquiries WHERE id IN (${placeholders})`,
      idsToDelete,
      function(err) {
        if (err) {
          console.error('\n❌ 삭제 실패:', err);
        } else {
          console.log(`\n✅ ${this.changes}개의 중복 항목이 삭제되었습니다.`);
        }
        db.close();
      }
    );
  }
);
