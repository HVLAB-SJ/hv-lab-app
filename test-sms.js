/**
 * SMS 발송 테스트 스크립트
 */

require('dotenv').config();

// SOLAPI 서비스 테스트
const solapiService = require('./utils/solapiService');

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
console.log('SMS 발송 테스트 시작');
console.log('========================================\n');

console.log('환경변수 확인:');
console.log('- SOLAPI_API_KEY:', process.env.SOLAPI_API_KEY ? '설정됨' : '없음');
console.log('- SOLAPI_API_SECRET:', process.env.SOLAPI_API_SECRET ? '설정됨' : '없음');
console.log('- SOLAPI_FROM_NUMBER:', process.env.SOLAPI_FROM_NUMBER);
console.log('- ADMIN_PHONE_NUMBERS:', process.env.ADMIN_PHONE_NUMBERS);
console.log('- SOLAPI_PFID:', process.env.SOLAPI_PFID);
console.log('- SOLAPI_TEMPLATE_ID:', process.env.SOLAPI_TEMPLATE_ID);
console.log('\n');

// SOLAPI 테스트
async function testSolapi() {
    console.log('📱 SOLAPI 알림톡 테스트');
    console.log('------------------------');

    try {
        const result = await solapiService.sendPaymentNotification(testData);
        console.log('\n✅ SOLAPI 테스트 결과:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('\n❌ SOLAPI 테스트 실패:');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

// CoolSMS 테스트
async function testCoolsms() {
    console.log('\n📱 CoolSMS 백업 테스트');
    console.log('------------------------');

    try {
        const coolsmsService = require('./utils/coolsmsService');
        const result = await coolsmsService.sendPaymentNotification(testData);
        console.log('\n✅ CoolSMS 테스트 결과:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('\n❌ CoolSMS 테스트 실패:');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

// 테스트 실행
async function runTests() {
    await testSolapi();
    await testCoolsms();

    console.log('\n========================================');
    console.log('테스트 완료');
    console.log('========================================\n');

    process.exit(0);
}

runTests();