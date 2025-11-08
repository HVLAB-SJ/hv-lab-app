const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('동일 이름의 95% 이상 유사한 견적문의 제거 중...\n');

// 문자열 유사도 계산 (Levenshtein Distance 기반)
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// 모든 견적문의를 이름별로 그룹화
db.all('SELECT id, name, message, created_at FROM quote_inquiries ORDER BY name, created_at', (err, rows) => {
  if (err) {
    console.error('조회 실패:', err);
    db.close();
    return;
  }

  if (!rows || rows.length === 0) {
    console.log('견적문의가 없습니다.');
    db.close();
    return;
  }

  console.log(`총 ${rows.length}개의 견적문의를 확인 중...\n`);

  // 이름별로 그룹화
  const groupedByName = {};
  rows.forEach(row => {
    if (!groupedByName[row.name]) {
      groupedByName[row.name] = [];
    }
    groupedByName[row.name].push(row);
  });

  const idsToDelete = [];
  let duplicateCount = 0;

  // 각 이름 그룹에서 중복 확인
  Object.keys(groupedByName).forEach(name => {
    const inquiries = groupedByName[name];

    if (inquiries.length <= 1) {
      return; // 1개만 있으면 건너뛰기
    }

    console.log(`\n"${name}" - ${inquiries.length}개 견적문의 검사 중...`);

    // 첫 번째 문의를 기준으로 나머지와 비교
    const firstInquiry = inquiries[0];

    for (let i = 1; i < inquiries.length; i++) {
      const inquiry = inquiries[i];
      const similarity = calculateSimilarity(
        firstInquiry.message.toLowerCase().trim(),
        inquiry.message.toLowerCase().trim()
      );

      if (similarity >= 0.95) {
        console.log(`  ✓ 중복 발견 (유사도 ${(similarity * 100).toFixed(1)}%)`);
        console.log(`    - 첫 견적: ID ${firstInquiry.id}, ${firstInquiry.created_at}`);
        console.log(`    - 중복 견적: ID ${inquiry.id}, ${inquiry.created_at} [삭제 예정]`);
        idsToDelete.push(inquiry.id);
        duplicateCount++;
      }
    }
  });

  if (idsToDelete.length === 0) {
    console.log('\n삭제할 중복 견적문의가 없습니다.');
    db.close();
    return;
  }

  console.log(`\n총 ${duplicateCount}개의 중복 견적문의를 삭제합니다...`);

  // 삭제 실행
  const placeholders = idsToDelete.map(() => '?').join(',');
  db.run(
    `DELETE FROM quote_inquiries WHERE id IN (${placeholders})`,
    idsToDelete,
    function(err) {
      if (err) {
        console.error('❌ 삭제 실패:', err);
      } else {
        console.log(`\n✅ ${this.changes}개의 중복 견적문의가 삭제되었습니다.`);
      }
      db.close();
    }
  );
});
