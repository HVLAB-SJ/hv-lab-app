# HV LAB 현장 관리 시스템

인테리어 현장 일정 및 결제 관리를 위한 통합 시스템

## 🚀 주요 기능

### 📅 일정 관리
- 프로젝트별 일정 관리
- 실시간 일정 업데이트 (Socket.io)
- 드래그 앤 드롭 일정 조정
- 진행률 시각화

### 💳 결제 관리
- 결제 요청/승인/완료 프로세스
- 카카오톡 알림 연동
- 계좌 정보 관리
- 결제 내역 추적

### 📱 카카오톡 알림
- 결제 요청 시 관리자 알림
- 결제 승인/완료 알림
- 실시간 알림 전송

## 🛠 기술 스택

- **Frontend**: HTML, CSS, JavaScript, jQuery
- **Backend**: Node.js, Express.js
- **Database**: SQLite
- **실시간 통신**: Socket.io
- **알림**: 카카오톡 메시지 API

## 📦 설치 방법

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일 편집

# 서버 시작
npm start
```

## 🔧 환경변수 설정

`.env` 파일 생성 및 설정:

```env
# 서버 설정
PORT=3000
NODE_ENV=development

# 데이터베이스
DB_PATH=./database.db

# JWT 설정
JWT_SECRET=your_secret_key

# 카카오 API
KAKAO_REST_API_KEY=your_api_key
KAKAO_ADMIN_KEY=your_admin_key
KAKAO_ADMIN_IDS=admin_kakao_id
```

## 📱 카카오톡 연동

1. 카카오 개발자 콘솔에서 앱 생성
2. 카카오톡 채널 연결
3. 관리자 인증: `/oauth/kakao/connect`
4. 알림 자동 발송 시작

## 🌐 배포

Railway 또는 Vercel을 통한 간편 배포 지원

## 📄 라이선스

Copyright © 2024 HV LAB. All rights reserved.