/**
 * CoolSMS 발송 테스트 스크립트
 */

require('dotenv').config();

// CoolSMS 서비스 테스트
const coolsmsService = require('./utils/coolsmsService');

// 테스트 데이터
const testData = {
    projectName: '테스트 프로젝트',
    amount: 100000,
    accountHolder: '홍길동',
    bankName: 'KB국민은행',
    accountNumber: '123-456-789012',
    requesterName: '김철수',
    itemName: '테스트 자재',
    purpose: '테스트 결제 요청',
    category: '자재비'
};

console.log('\n========================================');
console.log('CoolSMS 발송 테스트');
console.log('========================================\n');

console.log('환경변수 확인:');
console.log('- COOLSMS_API_KEY:', process.env.COOLSMS_API_KEY ? '설정됨' : '없음');
console.log('- COOLSMS_API_SECRET:', process.env.COOLSMS_API_SECRET ? '설정됨' : '없음');
console.log('- COOLSMS_FROM_NUMBER:', process.env.COOLSMS_FROM_NUMBER);
console.log('- ADMIN_PHONE_NUMBERS:', process.env.ADMIN_PHONE_NUMBERS);
console.log('\n');

// CoolSMS 테스트
async function testCoolsms() {
    console.log('📱 CoolSMS 문자 발송 테스트');
    console.log('------------------------');

    try {
        const result = await coolsmsService.sendPaymentNotification(testData);
        console.log('\n✅ CoolSMS 테스트 결과:');
        console.log(JSON.stringify(result, null, 2));

        // 결과 분석
        const successCount = result.filter(r => r.success).length;
        const failCount = result.filter(r => !r.success).length;

        console.log('\n📊 발송 통계:');
        console.log(`- 성공: ${successCount}건`);
        console.log(`- 실패: ${failCount}건`);

    } catch (error) {
        console.error('\n❌ CoolSMS 테스트 실패:');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

// 테스트 실행
async function runTest() {
    await testCoolsms();

    console.log('\n========================================');
    console.log('테스트 완료');
    console.log('========================================\n');

    process.exit(0);
}

runTest();