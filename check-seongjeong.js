const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('=== 성정현 관련 협력업체 확인 ===\n');

db.all(
  "SELECT id, name, contact_person, position, specialty FROM contractors WHERE contact_person LIKE '%성정현%' OR name LIKE '%성정현%'",
  [],
  (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log(`${rows.length}개의 레코드 발견:`);
      rows.forEach(row => {
        console.log(`\nID: ${row.id}`);
        console.log(`  업체명: ${row.name}`);
        console.log(`  담당자: ${row.contact_person}`);
        console.log(`  직책: ${row.position || '(없음)'}`);
        console.log(`  공정: ${row.specialty}`);

        // 담당자 이름에 "반장"이 포함된 경우
        if (row.contact_person && row.contact_person.includes('반장') && !row.position) {
          console.log('  → 수정 필요: 담당자 이름에 직책이 포함되어 있음');
        }
      });

      // 수정이 필요한 레코드 업데이트
      console.log('\n=== 수정 작업 시작 ===\n');

      const updates = [];
      rows.forEach(row => {
        if (row.contact_person === '성정현반장') {
          updates.push({
            id: row.id,
            newContactPerson: '성정현',
            newPosition: '반장'
          });
        }
      });

      if (updates.length > 0) {
        let completed = 0;
        updates.forEach(update => {
          db.run(
            'UPDATE contractors SET contact_person = ?, position = ? WHERE id = ?',
            [update.newContactPerson, update.newPosition, update.id],
            function(err) {
              if (err) {
                console.error(`❌ 업데이트 실패 (ID: ${update.id}):`, err);
              } else {
                console.log(`✅ 업데이트 완료 (ID: ${update.id}): 성정현반장 → 성정현 (반장)`);
              }

              completed++;
              if (completed === updates.length) {
                // 업데이트 후 확인
                console.log('\n=== 업데이트 후 확인 ===\n');
                db.all(
                  "SELECT id, name, contact_person, position FROM contractors WHERE contact_person LIKE '%성정현%'",
                  [],
                  (err, updatedRows) => {
                    if (!err) {
                      updatedRows.forEach(row => {
                        console.log(`ID ${row.id}: ${row.name} - 담당자: ${row.contact_person}, 직책: ${row.position || '(없음)'}`);
                      });
                    }
                    db.close();
                  }
                );
              }
            }
          );
        });
      } else {
        console.log('수정이 필요한 레코드가 없습니다.');
        db.close();
      }
    }
  }
);