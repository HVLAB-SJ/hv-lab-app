const { db } = require('../config/database');

const addPaymentImagesColumn = () => {
  return new Promise((resolve, reject) => {
    // 컬럼 존재 여부 확인
    db.all("PRAGMA table_info(payment_requests)", [], (err, columns) => {
      if (err) {
        console.error('테이블 정보 조회 실패:', err);
        reject(err);
        return;
      }

      const hasImagesColumn = columns.some(col => col.name === 'images');

      if (!hasImagesColumn) {
        db.run(
          `ALTER TABLE payment_requests ADD COLUMN images TEXT`,
          [],
          (err) => {
            if (err) {
              console.error('images 컬럼 추가 실패:', err);
              reject(err);
            } else {
              console.log('payment_requests 테이블에 images 컬럼 추가 완료');
              resolve();
            }
          }
        );
      } else {
        console.log('images 컬럼이 이미 존재합니다');
        resolve();
      }
    });
  });
};

module.exports = addPaymentImagesColumn;
