const { db } = require('./server/config/database');

console.log('🔄 협력업체 이름에서 직책 제거 중...\n');

// 직책 목록 (긴 것부터 매칭하도록 정렬)
const positions = [
  '대표이사', '부사장', '전무', '상무', '이사', '실장', '부장', '차장', '과장', '대리',
  '주임', '사원', '팀장', '소장', '대표', '사장', '회장', '반장', '현장', '본부장',
  '팀원', '파트장', '조장', '감독', '기사', '수석', '책임'
].sort((a, b) => b.length - a.length);

// 이름에서 직책 제거하는 함수
function removePosition(name) {
  if (!name) return { cleanName: name, position: '' };

  // "님" 제거
  let cleanName = name.replace(/님$/g, '').trim();
  let extractedPosition = '';

  // 직책 찾기
  for (const position of positions) {
    if (cleanName.endsWith(position)) {
      extractedPosition = position;
      cleanName = cleanName.substring(0, cleanName.length - position.length).trim();
      break;
    }
  }

  return { cleanName, position: extractedPosition };
}

// 모든 협력업체 조회
db.all('SELECT id, name, contact_person, position FROM contractors', [], (err, contractors) => {
  if (err) {
    console.error('❌ 협력업체 조회 실패:', err);
    db.close();
    return;
  }

  console.log(`📋 총 ${contractors.length}개 협력업체 처리 중...\n`);

  let updated = 0;
  let processed = 0;

  contractors.forEach((contractor) => {
    const { cleanName, position } = removePosition(contractor.contact_person);

    // 이름이 변경되었거나 직책이 추출된 경우에만 업데이트
    if (cleanName !== contractor.contact_person || position) {
      db.run(
        'UPDATE contractors SET contact_person = ?, position = ? WHERE id = ?',
        [cleanName, position || contractor.position || '', contractor.id],
        (err) => {
          if (err) {
            console.error(`❌ 업데이트 실패 (ID: ${contractor.id}):`, err);
          } else {
            if (contractor.contact_person !== cleanName) {
              console.log(`✅ ${contractor.contact_person} → ${cleanName}${position ? ` (직책: ${position})` : ''}`);
              updated++;
            }
          }
          processed++;
          checkComplete();
        }
      );
    } else {
      processed++;
      checkComplete();
    }
  });

  function checkComplete() {
    if (processed === contractors.length) {
      console.log(`\n✅ 처리 완료!`);
      console.log(`   업데이트됨: ${updated}개`);
      console.log(`   변경 없음: ${contractors.length - updated}개`);
      db.close();
    }
  }
});
