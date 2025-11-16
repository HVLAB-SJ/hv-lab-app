const { db } = require('./server/config/database');
const bcrypt = require('bcryptjs');

// 안팀 사용자 추가
const addAhnUser = () => {
  const ahnPassword = bcrypt.hashSync('0000', 10);

  db.run(
    'INSERT OR IGNORE INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)',
    ['안팀', ahnPassword, '안팀', 'worker', '시공부'],
    (err) => {
      if (err) {
        console.error('안팀 사용자 생성 오류:', err.message);
      } else {
        console.log('✅ 안팀 사용자 생성 완료');
      }

      // 확인
      db.get('SELECT * FROM users WHERE username = ?', ['안팀'], (err, user) => {
        if (user) {
          console.log('✅ 안팀 사용자가 데이터베이스에 추가되었습니다.');
        } else {
          console.log('❌ 안팀 사용자 추가 실패');
        }
        process.exit(0);
      });
    }
  );
};

// 실행
setTimeout(addAhnUser, 1000);