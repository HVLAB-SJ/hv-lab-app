/**
 * CoolSMS 발송 테스트 스크립트
 */

require('dotenv').config();

// CoolSMS 서비스 테스트
const coolsmsService = require('./utils/coolsmsService');

// 테스트 데이터
const testData = {
    projectName: '대림아크로텔_엄상진님',
    amount: 350000,
    accountHolder: '조준',
    bankName: '신한은행',
    accountNumber: '100-031-475333',
    requesterName: '김철수',
    itemName: '문틀 설치',  // 항목명 있는 경우 테스트
    purpose: '목공',  // 공정명 (목공, 가구, 마루, 도배, 타일 등)
    description: '목공',  // description도 공정명으로 사용
    category: 'material',  // 이제 사용하지 않음
    includesVat: true,  // VAT 포함 여부
    applyTaxDeduction: false  // 3.3% 세금공제 여부
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