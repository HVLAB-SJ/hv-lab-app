const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

// List of Korean position titles (ordered by length to match longer ones first)
const positions = [
  '대표이사', '부사장', '전무', '상무', '이사', '실장', '부장', '차장', '과장', '대리',
  '주임', '사원', '팀장', '소장', '대표', '사장', '회장', '반장', '현장', '본부장',
  '팀원', '파트장', '조장', '감독', '기사', '수석', '책임'
];

// Extract position from name
function extractPosition(name) {
  if (!name) return '';

  // Remove "님" suffix first if present
  const cleanName = name.replace(/님$/g, '').trim();

  // Check if position is separated by space (e.g., "성정현 반장")
  const parts = cleanName.split(' ');
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    for (const position of positions) {
      if (lastPart === position) {
        return position;
      }
    }
  }

  // Check if position is attached to the name (e.g., "김혁실장")
  for (const position of positions) {
    if (cleanName.endsWith(position)) {
      return position;
    }
  }

  return '';
}

// Remove position from name
function removePosition(name) {
  if (!name) return name;

  // Remove "님" suffix first if present
  let cleanName = name.replace(/님$/g, '').trim();

  // Check if position is separated by space
  const parts = cleanName.split(' ');
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    for (const position of positions) {
      if (lastPart === position) {
        // Return everything except the last part (position)
        return parts.slice(0, -1).join(' ').trim();
      }
    }
  }

  // Remove position if found at the end (attached to name)
  for (const position of positions) {
    if (cleanName.endsWith(position)) {
      return cleanName.substring(0, cleanName.length - position.length).trim();
    }
  }

  return cleanName;
}

console.log('=== 협력업체 이름/직책 분리 작업 시작 ===\n');

// First, check current data
db.all('SELECT id, contact_person, position, specialty, name FROM contractors ORDER BY specialty, contact_person', [], (err, rows) => {
  if (err) {
    console.error('Error fetching contractors:', err);
    db.close();
    return;
  }

  console.log('현재 협력업체 데이터 (' + rows.length + '개):');
  console.log('----------------------------------------');

  let updateCount = 0;
  let processedCount = 0;
  const updates = [];

  rows.forEach((row) => {
    const extractedPosition = extractPosition(row.contact_person);
    const cleanedName = removePosition(row.contact_person);
    const needsUpdate = (extractedPosition && !row.position) || (cleanedName !== row.contact_person);

    if (needsUpdate) {
      console.log(`[${row.specialty}] ${row.name} - ${row.contact_person}`);
      console.log(`  → 담당자: ${cleanedName}`);
      console.log(`  → 직책: ${extractedPosition || row.position || '(없음)'}`);
      console.log('');

      updates.push({
        id: row.id,
        oldName: row.contact_person,
        newName: cleanedName,
        position: row.position || extractedPosition || ''
      });
      updateCount++;
    }
  });

  if (updateCount === 0) {
    console.log('수정이 필요한 데이터가 없습니다.');

    // Show 목공 contractors
    console.log('\n=== 현재 목공 협력업체 확인 ===');
    db.all("SELECT name, contact_person, position, specialty FROM contractors WHERE specialty LIKE '%목공%' OR name LIKE '%목공%' ORDER BY contact_person", [], (err, rows) => {
      if (!err && rows.length > 0) {
        rows.forEach(row => {
          console.log(`[${row.specialty}] ${row.name}`);
          console.log(`  담당자: ${row.contact_person}, 직책: ${row.position || '(없음)'}`);
        });
      }
      db.close();
    });
    return;
  }

  console.log(`\n총 ${updateCount}개의 데이터가 수정이 필요합니다.\n`);
  console.log('=== 데이터 업데이트 시작 ===\n');

  // Update each contractor
  updates.forEach((update) => {
    db.run(
      'UPDATE contractors SET contact_person = ?, position = ? WHERE id = ?',
      [update.newName, update.position, update.id],
      function(err) {
        if (err) {
          console.error(`❌ Failed to update ${update.oldName}:`, err.message);
        } else {
          console.log(`✅ Updated: ${update.oldName} → 담당자: ${update.newName}, 직책: ${update.position || '(없음)'}`);
        }

        processedCount++;
        if (processedCount === updateCount) {
          console.log('\n=== 업데이트 완료 ===');

          // Verify the changes for 목공
          console.log('\n=== 업데이트 후 목공 협력업체 확인 ===');
          db.all("SELECT name, contact_person, position, specialty FROM contractors WHERE specialty LIKE '%목공%' OR name LIKE '%목공%' ORDER BY contact_person", [], (err, updatedRows) => {
            if (!err) {
              updatedRows.forEach(r => {
                console.log(`[${r.specialty}] ${r.name}`);
                console.log(`  담당자: ${r.contact_person}, 직책: ${r.position || '(없음)'}`);
              });
            }
            db.close();
          });
        }
      }
    );
  });
});