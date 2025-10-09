/**
 * 직접 메시지 테스트
 * 연동된 토큰으로 바로 메시지 보내기
 */

const kakaoMessage = require('./utils/kakaoMessage');
require('dotenv').config();

async function testDirectMessage() {
    console.log('=================================');
    console.log('카카오톡 직접 메시지 테스트');
    console.log('=================================\n');

    // 환경변수 확인
    console.log('설정된 관리자 ID:', process.env.KAKAO_ADMIN_IDS);
    console.log('REST API 키:', process.env.KAKAO_REST_API_KEY ? '설정됨' : '없음');
    console.log('');

    // 저장된 토큰 확인
    console.log('저장된 토큰 목록:');
    for (const [key, value] of kakaoMessage.tokenStore.entries()) {
        console.log(`- ${key}: 토큰 있음 (만료: ${new Date(value.expiresAt).toLocaleString()})`);
    }

    if (kakaoMessage.tokenStore.size === 0) {
        console.log('저장된 토큰이 없습니다!');
        console.log('\n해결 방법:');
        console.log('1. http://localhost:3000/oauth/kakao/connect 에서 인증');
        console.log('2. 인증 완료 후 이 스크립트 다시 실행');
        return;
    }

    // 테스트 메시지 생성
    const testMessage = kakaoMessage.createPaymentRequestMessage({
        requesterName: '테스트 사용자',
        projectName: '테스트 프로젝트',
        amount: 100000,
        category: '자재비',
        description: '테스트 결제 요청입니다',
        accountInfo: {
            bank: '국민은행',
            accountNumber: '123-456-789',
            accountHolder: '홍길동'
        }
    });

    console.log('\n생성된 메시지:');
    console.log('-------------------');
    console.log(testMessage);
    console.log('-------------------\n');

    // 관리자들에게 메시지 발송
    console.log('메시지 발송 중...\n');

    try {
        // notifyAdmins 대신 직접 발송 테스트
        const adminIds = process.env.KAKAO_ADMIN_IDS.split(',');

        for (const adminId of adminIds) {
            console.log(`${adminId}에게 발송 시도...`);

            // 여러 가지 키 형태로 시도
            const possibleKeys = [
                adminId,
                `admin`,
                `user_${adminId}`,
                'sangjun217@nate.com'
            ];

            let sent = false;
            for (const key of possibleKeys) {
                if (kakaoMessage.tokenStore.has(key)) {
                    console.log(`  → ${key} 키로 토큰 발견!`);
                    const tokenData = kakaoMessage.tokenStore.get(key);

                    try {
                        await kakaoMessage.sendToMe(tokenData.accessToken, testMessage);
                        console.log(`  ✅ 발송 성공!`);
                        sent = true;
                        break;
                    } catch (error) {
                        console.log(`  ❌ 발송 실패:`, error.response?.data || error.message);
                    }
                }
            }

            if (!sent) {
                console.log(`  ⚠️ ${adminId}의 토큰을 찾을 수 없습니다`);
            }
        }
    } catch (error) {
        console.error('발송 중 오류:', error);
    }

    console.log('\n테스트 완료!');
}

// 실행
testDirectMessage();