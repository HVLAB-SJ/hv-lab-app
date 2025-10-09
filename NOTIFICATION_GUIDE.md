# 알림 시스템 설정 가이드

## 1. 카카오톡 알림톡 설정 방법

### 카카오 비즈니스 계정 생성
1. [카카오 비즈니스](https://business.kakao.com) 접속
2. 회사 계정으로 가입
3. 채널 개설 (예: "HV LAB 현장관리")

### 알림톡 템플릿 등록
```
[결제 요청 알림]
#{요청자}님이 결제를 요청했습니다.

현장: #{현장명}
금액: #{금액}원
내용: #{내용}

▶ 앱에서 확인하기
```

### API 연동 (server/utils/notification.js)
```javascript
const axios = require('axios');

// 카카오톡 알림톡 전송
async function sendKakaoNotification(phoneNumber, templateId, params) {
    const KAKAO_API_KEY = process.env.KAKAO_API_KEY;

    try {
        const response = await axios.post(
            'https://api.kakaowork.com/v1/messages.send',
            {
                phone: phoneNumber,
                template_id: templateId,
                template_args: params
            },
            {
                headers: {
                    'Authorization': `Bearer ${KAKAO_API_KEY}`
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('카카오톡 전송 실패:', error);
    }
}
```

## 2. 이메일 알림 설정

### Gmail SMTP 설정
1. Gmail 계정에서 2단계 인증 활성화
2. 앱 비밀번호 생성
3. .env 파일에 추가:
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Nodemailer 설정
```bash
npm install nodemailer
```

```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendEmailNotification(to, subject, html) {
    try {
        await transporter.sendMail({
            from: '"현장관리시스템" <noreply@company.com>',
            to: to,
            subject: subject,
            html: html
        });
    } catch (error) {
        console.error('이메일 전송 실패:', error);
    }
}
```

## 3. 웹 푸시 알림 (무료 대안)

### Service Worker 등록
```javascript
// public/js/push-notification.js
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');

    // 푸시 알림 권한 요청
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            console.log('알림 권한 획득');
        }
    });
}

// 알림 표시
function showNotification(title, options) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: options.body,
            icon: '/images/icon.png',
            badge: '/images/badge.png',
            vibrate: [200, 100, 200]
        });
    }
}
```

## 4. Slack 연동 (팀 협업용)

### Webhook URL 생성
1. Slack 워크스페이스 설정
2. Incoming Webhooks 앱 추가
3. 채널 선택 및 Webhook URL 복사

### 메시지 전송
```javascript
async function sendSlackNotification(message) {
    const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

    await axios.post(SLACK_WEBHOOK_URL, {
        text: message,
        attachments: [{
            color: 'warning',
            title: '새로운 결제 요청',
            fields: [
                { title: '요청자', value: message.requester },
                { title: '금액', value: message.amount },
                { title: '내용', value: message.description }
            ]
        }]
    });
}
```

## 5. 실시간 알림 (Socket.IO)

현재 구현되어 있는 실시간 알림:
- 새 결제 요청 시 관리자에게 실시간 알림
- 승인/거절 시 요청자에게 실시간 알림
- 브라우저가 열려있을 때만 작동

## 권장 설정

### 소규모 팀 (10명 이하)
- **웹 푸시 알림** + **이메일** 조합 추천
- 무료로 구현 가능
- 설정이 간단함

### 중규모 팀 (10-50명)
- **Slack** + **이메일** 조합 추천
- 팀 협업에 효과적
- 히스토리 관리 용이

### 대규모/공식 운영
- **카카오톡 알림톡** + **이메일** 조합
- 전문적이고 신뢰도 높음
- 비용 발생 (건당 10-20원)

## 테스트 방법

1. 개발 환경에서 콘솔 로그로 확인
2. 이메일은 Mailtrap 같은 테스트 서비스 활용
3. Slack은 개인 워크스페이스에서 테스트
4. 카카오톡은 테스트 발송 기능 활용