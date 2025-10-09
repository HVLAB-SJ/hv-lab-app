/**
 * 카카오톡 메시지 테스트 스크립트
 * 나에게 메시지 보내기 테스트
 */

const axios = require('axios');
require('dotenv').config();

// 카카오 API 설정
const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const REDIRECT_URI = 'http://localhost:3000/oauth/kakao';

/**
 * 1단계: 카카오 인증 URL 생성
 * 브라우저에서 이 URL로 접속하여 인증을 받아야 합니다
 */
function getAuthUrl() {
    const authUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=talk_message`;
    console.log('\n===== 카카오 인증 =====');
    console.log('아래 URL을 브라우저에서 열어 카카오 로그인을 하세요:');
    console.log(authUrl);
    console.log('\n리다이렉트된 URL에서 code= 뒤의 값을 복사하세요');
    console.log('예: http://localhost:3000/oauth/kakao?code=XXXXX');
    return authUrl;
}

/**
 * 2단계: 인증 코드로 액세스 토큰 받기
 */
async function getAccessToken(authCode) {
    try {
        const response = await axios.post('https://kauth.kakao.com/oauth/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: REST_API_KEY,
                redirect_uri: REDIRECT_URI,
                code: authCode
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('\n===== 액세스 토큰 발급 성공 =====');
        console.log('액세스 토큰:', response.data.access_token);
        return response.data.access_token;
    } catch (error) {
        console.error('토큰 발급 실패:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 3단계: 나에게 메시지 보내기
 */
async function sendMessageToMe(accessToken) {
    try {
        // 메시지 템플릿 (텍스트 메시지)
        const template = {
            object_type: 'text',
            text: '🎉 HV LAB 카카오톡 메시지 테스트\n\n테스트 메시지가 성공적으로 전송되었습니다!\n\n결제 알림 시스템이 정상적으로 작동하고 있습니다.',
            link: {
                web_url: 'http://localhost:3000',
                mobile_web_url: 'http://localhost:3000'
            },
            button_title: '시스템 접속'
        };

        const response = await axios.post('https://kapi.kakao.com/v2/api/talk/memo/default/send',
            `template_object=${encodeURIComponent(JSON.stringify(template))}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log('\n===== 메시지 전송 성공! =====');
        console.log('카카오톡을 확인하세요!');
        return response.data;
    } catch (error) {
        console.error('메시지 전송 실패:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * 메인 실행 함수
 */
async function main() {
    console.log('=================================');
    console.log('카카오톡 메시지 테스트 시작');
    console.log('=================================\n');

    // 명령줄 인자로 인증 코드를 받을 수 있도록 처리
    const authCode = process.argv[2];

    if (!authCode) {
        // 인증 코드가 없으면 인증 URL 표시
        getAuthUrl();
        console.log('\n위 URL로 인증 후, 다음 명령어를 실행하세요:');
        console.log('node test-kakao-message.js [인증코드]');
        console.log('\n예시:');
        console.log('node test-kakao-message.js ABC123XYZ789');
    } else {
        // 인증 코드가 있으면 메시지 전송
        try {
            console.log('인증 코드:', authCode);
            const accessToken = await getAccessToken(authCode);
            await sendMessageToMe(accessToken);
            console.log('\n테스트 완료!');
        } catch (error) {
            console.error('\n테스트 실패:', error.message);
        }
    }
}

// 프로그램 실행
main();