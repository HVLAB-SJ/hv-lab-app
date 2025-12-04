// execution_records 테이블에 images 컬럼 추가 마이그레이션
module.exports = function addExecutionRecordImages(db) {
  return new Promise((resolve, reject) => {
    // 먼저 컬럼 존재 여부 확인
    db.all('PRAGMA table_info(execution_records)', (err, columns) => {
      if (err) {
        console.error('execution_records 테이블 정보 조회 실패:', err);
        reject(err);
        return;
      }

      const hasImagesColumn = columns && columns.some(col => col.name === 'images');

      if (hasImagesColumn) {
        console.log('✅ execution_records.images 컬럼이 이미 존재합니다');
        resolve();
        return;
      }

      // images 컬럼 추가 (JSON 문자열로 저장)
      db.run(`ALTER TABLE execution_records ADD COLUMN images TEXT DEFAULT '[]'`, function(err) {
        if (err) {
          console.error('execution_records.images 컬럼 추가 실패:', err);
          reject(err);
        } else {
          console.log('✅ execution_records.images 컬럼 추가 완료');
          resolve();
        }
      });
    });
  });
};
