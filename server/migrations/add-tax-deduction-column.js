// execution_records 테이블에 includes_tax_deduction 컬럼 추가
module.exports = function addTaxDeductionColumn(db) {
  return new Promise((resolve, reject) => {
    // 먼저 컬럼이 존재하는지 확인
    db.all("PRAGMA table_info(execution_records)", [], (err, columns) => {
      if (err) {
        console.error('테이블 정보 조회 실패:', err);
        reject(err);
        return;
      }

      const hasColumn = columns.some(col => col.name === 'includes_tax_deduction');

      if (hasColumn) {
        console.log('includes_tax_deduction 컬럼이 이미 존재합니다.');
        resolve();
        return;
      }

      db.run(`
        ALTER TABLE execution_records ADD COLUMN includes_tax_deduction INTEGER DEFAULT 0
      `, function(err) {
        if (err) {
          console.error('includes_tax_deduction 컬럼 추가 실패:', err);
          reject(err);
        } else {
          console.log('includes_tax_deduction 컬럼 추가 완료');
          resolve();
        }
      });
    });
  });
};
