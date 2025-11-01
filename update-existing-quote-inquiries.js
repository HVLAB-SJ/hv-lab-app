/**
 * 기존 견적문의 데이터를 메일에서 다시 가져와서 업데이트하는 스크립트
 */

const emailService = require('./utils/emailService');
const { db } = require('./server/config/database');

async function updateExistingInquiries() {
  console.log('🔄 기존 견적문의 데이터 업데이트 시작...');

  try {
    // 기존 견적문의 데이터 삭제 (메일에서 다시 가져올 것)
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM quote_inquiries', [], (err) => {
        if (err) {
          console.error('❌ 기존 데이터 삭제 실패:', err);
          reject(err);
        } else {
          console.log('✅ 기존 데이터 삭제 완료');
          resolve();
        }
      });
    });

    // 메일에서 견적문의 다시 가져오기
    console.log('📧 메일에서 견적문의를 다시 가져옵니다...');
    const inquiries = await emailService.checkNewQuoteInquiries();

    if (inquiries && inquiries.length > 0) {
      console.log(`✅ ${inquiries.length}개의 견적문의를 성공적으로 업데이트했습니다.`);
    } else {
      console.log('⚠️ 가져온 견적문의가 없습니다.');
    }

    // 결과 확인
    db.all('SELECT id, name, phone, LENGTH(message) as msg_len FROM quote_inquiries', [], (err, rows) => {
      if (err) {
        console.error('❌ 데이터 확인 실패:', err);
      } else {
        console.log('\n📊 업데이트된 견적문의 목록:');
        rows.forEach(row => {
          console.log(`  - ID: ${row.id}, 이름: ${row.name}, 전화: ${row.phone}, 메시지 길이: ${row.msg_len}자`);
        });
      }

      db.close(() => {
        console.log('\n✅ 업데이트 완료');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ 업데이트 실패:', error);
    process.exit(1);
  }
}

updateExistingInquiries();
