const { db } = require('../config/database');

async function addSubImagesColumn() {
  return new Promise((resolve, reject) => {
    // 먼저 컬럼이 존재하는지 확인
    db.all("PRAGMA table_info(specbook_items)", [], (err, columns) => {
      if (err) {
        console.error('❌ 테이블 정보 조회 실패:', err);
        reject(err);
        return;
      }

      const hasSubImages = columns.some(col => col.name === 'sub_images');

      if (hasSubImages) {
        console.log('✅ sub_images 컬럼이 이미 존재합니다');
        resolve();
        return;
      }

      // sub_images 컬럼 추가
      db.run(`
        ALTER TABLE specbook_items
        ADD COLUMN sub_images TEXT
      `, (err) => {
        if (err) {
          console.error('❌ sub_images 컬럼 추가 실패:', err);
          reject(err);
        } else {
          console.log('✅ sub_images 컬럼 추가 완료');
          resolve();
        }
      });
    });
  });
}

module.exports = addSubImagesColumn;
