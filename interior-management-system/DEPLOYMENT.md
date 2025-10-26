# 배포 가이드 (Railway Deployment Guide)

## 📋 배포 전 체크리스트

### 1. 코드 변경 후 필수 확인 사항

#### Frontend 변경 시:
- [ ] TypeScript 컴파일 오류 없음: `npm run build`
- [ ] 환경 변수 확인: `.env` 파일 존재
- [ ] API URL 설정 확인: `VITE_API_URL`
- [ ] package.json 빌드 스크립트 확인

#### Backend 변경 시:
- [ ] TypeScript 컴파일 오류 없음: `npm run build`
- [ ] 모든 import가 올바른지 확인
- [ ] 환경 변수 의존성 확인
- [ ] MongoDB 연결 테스트

### 2. Railway 배포 설정

#### Frontend Service (hvlab.app)
```
환경 변수:
- VITE_API_URL=https://api.hvlab.app/api
- VITE_SOCKET_URL=https://api.hvlab.app
- VITE_APP_NAME=Interior Management System
- VITE_APP_VERSION=1.0.0
```

#### Backend Service (api.hvlab.app)
```
환경 변수:
- MONGODB_URI=[MongoDB 연결 URL]
- NODE_ENV=production
- PORT=5000
- JWT_SECRET=[JWT 비밀키]
- JWT_EXPIRE=7d
- NOTIFICATION_PHONE_NUMBER=01074088864
- COOLSMS_API_KEY=NCSAOUKZWBK9ISKK
- COOLSMS_API_SECRET=OUETIQGRMUWMWYYU4KKJMCROBLPMSNMB
- COOLSMS_FROM_NUMBER=01074088864
- KAKAO_REST_API_KEY=[카카오 REST API 키]
- KAKAO_ADMIN_KEY=[카카오 Admin 키]
- FRONTEND_URL=https://hvlab.app
- CORS_ORIGIN=https://hvlab.app
```

## 🚀 배포 프로세스

### 자동 배포 (권장)

1. **로컬에서 코드 수정**
2. **빌드 테스트**
   ```bash
   # Frontend
   cd frontend && npm run build

   # Backend
   cd backend && npm run build
   ```
3. **커밋 및 푸시**
   ```bash
   git add .
   git commit -m "설명"
   git push origin main
   ```
4. **Railway 자동 배포 확인**
   - https://railway.app 접속
   - 프로젝트 선택
   - Frontend/Backend 서비스 Deployments 탭 확인

### 수동 배포 트리거

배포가 자동으로 시작되지 않을 경우 package.json 버전 업데이트 후 푸시

## ⚠️ 주의사항

- 항상 로컬에서 빌드 테스트 후 푸시
- TypeScript 에러는 배포 전 반드시 수정
- 환경 변수 변경 시 Railway에서 수동 설정 필요
- 프론트엔드와 백엔드 모두 자동 배포 확인 필수
