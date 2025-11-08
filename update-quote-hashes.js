const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('기존 견적문의에 content_hash 업데이트 중...\n');

function generateContentHash(message) {
  // 메시지 내용 전체를 해시 (공백 제거하여 정규화)
  const normalizedMessage = message.replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalizedMessage).digest('hex');
}

// 모든 견적문의를 다시 업데이트 (이름+전화 기반 해시 -> 메시지 내용 기반 해시)
db.all('SELECT id, name, phone, message FROM quote_inquiries', (err, rows) => {
  if (err) {
    console.error('조회 실패:', err);
    db.close();
    return;
  }

  if (!rows || rows.length === 0) {
    console.log('업데이트할 데이터가 없습니다.');
    db.close();
    return;
  }

  console.log(`${rows.length}개의 견적문의에 content_hash를 추가합니다.\n`);

  let updated = 0;
  const stmt = db.prepare('UPDATE quote_inquiries SET content_hash = ? WHERE id = ?');

  rows.forEach((row, idx) => {
    const hash = generateContentHash(row.message);
    stmt.run(hash, row.id, (err) => {
      if (err) {
        console.error(`❌ ID ${row.id} 업데이트 실패:`, err);
      } else {
        updated++;
        console.log(`✓ [${updated}/${rows.length}] ID ${row.id}: ${row.name} (메시지 기반 해시)`);
      }

      if (idx === rows.length - 1) {
        stmt.finalize();
        console.log(`\n✅ ${updated}개의 견적문의에 메시지 기반 content_hash가 업데이트되었습니다.`);
        db.close();
      }
    });
  });
});
