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
db.all('SELECT id, name, position, process FROM contractors ORDER BY process, name', [], (err, rows) => {
  if (err) {
    console.error('Error fetching contractors:', err);
    db.close();
    return;
  }

  console.log('현재 협력업체 데이터 (' + rows.length + '개):');
  console.log('----------------------------------------');

  let updateCount = 0;
  let processedCount = 0;

  rows.forEach((row, index) => {
    const extractedPosition = extractPosition(row.name);
    const cleanedName = removePosition(row.name);
    const needsUpdate = (extractedPosition && !row.position) || (cleanedName !== row.name);

    if (needsUpdate) {
      console.log(`[${row.process}] ${row.name}`);
      console.log(`  → 이름: ${cleanedName}`);
      console.log(`  → 직책: ${extractedPosition || row.position || '(없음)'}`);
      console.log('');
      updateCount++;
    }
  });

  if (updateCount === 0) {
    console.log('수정이 필요한 데이터가 없습니다.');
    db.close();
    return;
  }

  console.log(`\n총 ${updateCount}개의 데이터가 수정이 필요합니다.\n`);
  console.log('=== 데이터 업데이트 시작 ===\n');

  // Update each contractor
  rows.forEach((row) => {
    const extractedPosition = extractPosition(row.name);
    const cleanedName = removePosition(row.name);
    const finalPosition = row.position || extractedPosition || '';
    const needsUpdate = (extractedPosition && !row.position) || (cleanedName !== row.name);

    if (needsUpdate) {
      db.run(
        'UPDATE contractors SET name = ?, position = ? WHERE id = ?',
        [cleanedName, finalPosition, row.id],
        function(err) {
          if (err) {
            console.error(`❌ Failed to update ${row.name}:`, err.message);
          } else {
            console.log(`✅ Updated: ${row.name} → 이름: ${cleanedName}, 직책: ${finalPosition || '(없음)'}`);
          }

          processedCount++;
          if (processedCount === updateCount) {
            console.log('\n=== 업데이트 완료 ===');

            // Verify the changes
            console.log('\n=== 업데이트 후 목공 협력업체 확인 ===');
            db.all("SELECT name, position, process FROM contractors WHERE process='목공' ORDER BY name", [], (err, updatedRows) => {
              if (!err) {
                updatedRows.forEach(r => {
                  console.log(`[${r.process}] 이름: ${r.name}, 직책: ${r.position || '(없음)'}`);
                });
              }
              db.close();
            });
          }
        }
      );
    }
  });
});