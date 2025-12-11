const { db } = require('./server/config/database');

// 모든 현장일지 데이터 확인
console.log('\n=== 현장일지 데이터 확인 ===\n');

db.all(`SELECT id, project, date, images, notes, created_by, created_at FROM site_logs ORDER BY created_at DESC LIMIT 20`, (err, rows) => {
  if (err) {
    console.error('조회 실패:', err);
    process.exit(1);
  }

  console.log(`총 ${rows.length}개의 최근 현장일지:\n`);

  rows.forEach((row, index) => {
    console.log(`[${index + 1}] ID: ${row.id}`);
    console.log(`    프로젝트: ${row.project}`);
    console.log(`    날짜: ${row.date}`);
    console.log(`    작성자: ${row.created_by}`);
    console.log(`    작성일시: ${row.created_at}`);
    console.log(`    메모: ${row.notes || '없음'}`);

    // 이미지 파싱
    try {
      const images = JSON.parse(row.images || '[]');
      console.log(`    이미지 수: ${images.length}개`);

      if (images.length > 0) {
        console.log(`    이미지 데이터 형식 확인:`);
        // 첫 번째 이미지의 처음 100자만 출력
        const firstImage = images[0];
        if (firstImage.startsWith('data:image')) {
          console.log(`      - Base64 이미지 (${firstImage.substring(0, 50)}...)`);
        } else {
          console.log(`      - 이미지 경로: ${firstImage}`);
        }
      }
    } catch (e) {
      console.log(`    이미지 파싱 실패:`, e.message);
    }

    console.log('---');
  });

  // 전체 통계
  db.get(`SELECT COUNT(*) as total, COUNT(DISTINCT project) as projects FROM site_logs`, (err, stats) => {
    if (!err && stats) {
      console.log(`\n=== 전체 통계 ===`);
      console.log(`총 현장일지 수: ${stats.total}개`);
      console.log(`프로젝트 수: ${stats.projects}개`);
    }

    // 이미지가 없는 로그 확인
    db.all(`SELECT id, project, date FROM site_logs WHERE images = '[]' OR images IS NULL`, (err, emptyLogs) => {
      if (!err && emptyLogs.length > 0) {
        console.log(`\n=== 이미지가 없는 현장일지 ===`);
        console.log(`총 ${emptyLogs.length}개의 현장일지에 이미지가 없습니다.`);
        emptyLogs.slice(0, 5).forEach(log => {
          console.log(`  - ${log.project} (${log.date})`);
        });
      }

      process.exit(0);
    });
  });
});