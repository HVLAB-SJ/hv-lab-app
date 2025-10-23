const { db } = require('./server/config/database');

// 직책 키워드 목록 (우선순위 순서대로)
const positionKeywords = [
  '사장님', '사장', '대표님', '대표', '전무님', '전무', '이사',
  '부장님', '부장', '차장님', '차장', '과장님', '과장',
  '팀장님', '팀장', '실장님', '실장', '책임', '대리님', '대리',
  '주임', '반장님', '반장', '기사님', '매니저', '팀'
];

// 이름에서 직책 추출 및 분리
function extractPosition(name) {
  if (!name || name.trim() === '') return { name: '', position: '' };

  let cleanName = name.trim();
  let position = '';

  // 직책 키워드를 우선순위대로 찾기
  for (const keyword of positionKeywords) {
    if (cleanName.includes(keyword)) {
      position = keyword.replace('님', ''); // "사장님" -> "사장"
      cleanName = cleanName.replace(keyword, '').trim();
      break;
    }
  }

  // 특수 케이스 처리
  if (cleanName === '센터' || cleanName === '담당자' || cleanName === '고객센터' ||
      cleanName === '회사폰' || cleanName === '대표번호' || cleanName === '발주/견적 담당자') {
    return { name: cleanName, position: '' };
  }

  // 괄호 안의 내용 제거 (예: "고정훈 실장님(시공)" -> "고정훈", "실장")
  const bracketMatch = cleanName.match(/^(.+?)\s*\([^)]+\)$/);
  if (bracketMatch) {
    cleanName = bracketMatch[1].trim();
  }

  return { name: cleanName, position: position };
}

// 모든 협력업체 업데이트
db.all('SELECT id, contact_person FROM contractors', (err, rows) => {
  if (err) {
    console.error('Query error:', err);
    process.exit(1);
  }

  console.log(`Total contractors: ${rows.length}\n`);

  let updateCount = 0;
  let processedCount = 0;

  rows.forEach((row, index) => {
    const { name, position } = extractPosition(row.contact_person);

    // 변경 사항이 있는 경우에만 업데이트
    if (name !== row.contact_person || position !== '') {
      db.run(
        'UPDATE contractors SET contact_person = ?, position = ? WHERE id = ?',
        [name, position, row.id],
        function(updateErr) {
          if (updateErr) {
            console.error(`Error updating ID ${row.id}:`, updateErr);
          } else {
            updateCount++;
            console.log(`✅ ID ${row.id}: "${row.contact_person}" -> Name: "${name}", Position: "${position}"`);
          }

          processedCount++;
          if (processedCount === rows.length) {
            console.log(`\n✅ Update completed: ${updateCount} contractors updated`);
            process.exit(0);
          }
        }
      );
    } else {
      processedCount++;
      if (processedCount === rows.length) {
        console.log(`\n✅ Update completed: ${updateCount} contractors updated`);
        process.exit(0);
      }
    }
  });
});
