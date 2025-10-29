const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

console.log('📋 일정 제목 변환 시작...');

// 1. 모든 일정 조회
db.all(`
  SELECT s.id, s.project_id, s.title, p.name as project_name, p.client
  FROM schedules s
  LEFT JOIN projects p ON s.project_id = p.id
  WHERE s.title LIKE '[%]%'
`, [], (err, schedules) => {
  if (err) {
    console.error('❌ 일정 조회 실패:', err);
    db.close();
    return;
  }

  console.log(`📊 총 ${schedules.length}개의 일정을 찾았습니다.`);

  if (schedules.length === 0) {
    console.log('✅ 변환할 일정이 없습니다.');
    db.close();
    return;
  }

  let updated = 0;
  let skipped = 0;

  schedules.forEach((schedule, index) => {
    const { id, project_id, title, project_name, client } = schedule;

    if (!project_id || !project_name) {
      console.log(`⏭️  ID ${id}: 프로젝트 정보 없음, 건너뜀`);
      skipped++;
      return;
    }

    // 프로젝트명 앞 2글자 추출
    const projectPrefix = project_name.substring(0, 2);
    const clientName = client || '';

    // title에서 [프로젝트명] 부분 추출하고 나머지 내용 유지
    const titleContent = title.substring(title.indexOf(']') + 1).trim();
    const newTitle = clientName
      ? `[${projectPrefix}_${clientName}] ${titleContent}`
      : `[${projectPrefix}] ${titleContent}`;

    // 이미 변환된 형태면 건너뛰기
    if (title === newTitle) {
      console.log(`⏭️  ID ${id}: 이미 변환된 제목, 건너뜀`);
      skipped++;
      return;
    }

    console.log(`🔄 ID ${id}: "${title}" → "${newTitle}"`);

    db.run(
      `UPDATE schedules SET title = ? WHERE id = ?`,
      [newTitle, id],
      function(updateErr) {
        if (updateErr) {
          console.error(`❌ ID ${id} 업데이트 실패:`, updateErr);
        } else {
          updated++;
          console.log(`✅ ID ${id} 업데이트 완료 (${updated}/${schedules.length})`);
        }

        // 마지막 항목 처리 후 종료
        if (index === schedules.length - 1) {
          setTimeout(() => {
            console.log(`\n📊 변환 완료: ${updated}개 업데이트, ${skipped}개 건너뜀`);
            db.close();
          }, 100);
        }
      }
    );
  });

  // 모든 일정이 건너뛰어진 경우
  if (updated === 0 && skipped === schedules.length) {
    console.log(`\n📊 변환 완료: ${updated}개 업데이트, ${skipped}개 건너뜀`);
    db.close();
  }
});
