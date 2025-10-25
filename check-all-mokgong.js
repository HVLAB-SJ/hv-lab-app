const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('=== 모든 목공 협력업체 확인 ===\n');

// 목공 관련 모든 데이터 확인
db.all(
  "SELECT id, name, contact_person, position, specialty FROM contractors WHERE specialty LIKE '%목공%' OR name LIKE '%목공%' ORDER BY id",
  [],
  (err, rows) => {
    if (err) {
      console.error('Error:', err);
      db.close();
      return;
    }

    console.log(`총 ${rows.length}개의 목공 협력업체 발견:\n`);

    let needsUpdate = [];

    rows.forEach(row => {
      console.log(`ID ${row.id}: ${row.name}`);
      console.log(`  담당자: [${row.contact_person}]`);
      console.log(`  직책: [${row.position || '없음'}]`);
      console.log(`  공정: ${row.specialty}`);

      // 이름에 직책이 포함된 경우 체크
      if (row.contact_person && row.contact_person.includes('반장')) {
        console.log('  ⚠️  담당자 이름에 "반장"이 포함됨!');

        // 성정현반장 → 성정현 (반장)
        if (row.contact_person === '성정현반장') {
          needsUpdate.push({
            id: row.id,
            oldName: row.contact_person,
            newName: '성정현',
            position: '반장'
          });
        }
        // 정태희반장 → 정태희 (반장)
        else if (row.contact_person === '정태희반장') {
          needsUpdate.push({
            id: row.id,
            oldName: row.contact_person,
            newName: '정태희',
            position: '반장'
          });
        }
        // 다른 형태의 반장
        else if (row.contact_person.endsWith('반장')) {
          const cleanName = row.contact_person.replace('반장', '').trim();
          needsUpdate.push({
            id: row.id,
            oldName: row.contact_person,
            newName: cleanName,
            position: '반장'
          });
        }
      }
      console.log('');
    });

    if (needsUpdate.length > 0) {
      console.log(`\n=== ${needsUpdate.length}개 레코드 수정 필요 ===\n`);

      let completed = 0;
      needsUpdate.forEach(update => {
        console.log(`수정 중: ${update.oldName} → ${update.newName} (${update.position})`);

        db.run(
          'UPDATE contractors SET contact_person = ?, position = ? WHERE id = ?',
          [update.newName, update.position, update.id],
          function(err) {
            if (err) {
              console.error(`  ❌ 실패: ${err.message}`);
            } else {
              console.log(`  ✅ 완료`);
            }

            completed++;
            if (completed === needsUpdate.length) {
              console.log('\n=== 수정 후 재확인 ===\n');

              db.all(
                "SELECT id, name, contact_person, position FROM contractors WHERE specialty LIKE '%목공%' ORDER BY id",
                [],
                (err, updatedRows) => {
                  if (!err) {
                    updatedRows.forEach(row => {
                      console.log(`ID ${row.id}: ${row.name} - 담당자: [${row.contact_person}], 직책: [${row.position || '없음'}]`);
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
      console.log('모든 목공 협력업체의 이름과 직책이 올바르게 분리되어 있습니다.');
      db.close();
    }
  }
);