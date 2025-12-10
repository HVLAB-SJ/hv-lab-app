// execution_records 테이블에 includes_vat 컬럼 추가
module.exports = function addIncludesVatColumn(db) {
  return new Promise((resolve, reject) => {
    // 먼저 컬럼이 존재하는지 확인
    db.all("PRAGMA table_info(execution_records)", [], (err, columns) => {
      if (err) {
        console.error('테이블 정보 조회 실패:', err);
        reject(err);
        return;
      }

      const hasColumn = columns.some(col => col.name === 'includes_vat');

      if (hasColumn) {
        console.log('includes_vat 컬럼이 이미 존재합니다.');
        // 기존 데이터 중 vat_amount > 0이면서 includes_vat = 0인 경우 업데이트
        db.run(`
          UPDATE execution_records SET includes_vat = 1 WHERE vat_amount > 0 AND includes_vat = 0
        `, function(updateErr) {
          if (updateErr) {
            console.error('기존 데이터 includes_vat 업데이트 실패:', updateErr);
          } else if (this.changes > 0) {
            console.log(`기존 데이터 ${this.changes}개의 includes_vat 업데이트 완료`);
          }
          resolve();
        });
        return;
      }

      db.run(`
        ALTER TABLE execution_records ADD COLUMN includes_vat INTEGER DEFAULT 0
      `, function(err) {
        if (err) {
          console.error('includes_vat 컬럼 추가 실패:', err);
          reject(err);
        } else {
          console.log('includes_vat 컬럼 추가 완료');
          // 기존 데이터 중 vat_amount > 0인 경우 includes_vat = 1로 업데이트
          db.run(`
            UPDATE execution_records SET includes_vat = 1 WHERE vat_amount > 0
          `, function(updateErr) {
            if (updateErr) {
              console.error('기존 데이터 includes_vat 업데이트 실패:', updateErr);
            } else {
              console.log('기존 데이터 includes_vat 업데이트 완료 (vat_amount > 0인 레코드)');
            }
            resolve();
          });
        }
      });
    });
  });
};
