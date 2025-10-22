# Railway 환경 변수 설정 가이드

## Railway 대시보드에서 환경 변수 설정하기

1. **Railway 대시보드 접속**
   - https://railway.app 로그인
   - HV_WORKS 프로젝트 선택
   - hv-lab-app 서비스 클릭

2. **Variables 탭 클릭**

3. **다음 환경 변수들을 추가/수정**

### 필수 환경 변수

PORT=8080
NODE_ENV=production
JWT_SECRET=hvlab-jwt-secret-2024-secure-key
SESSION_EXPIRE=30d
CORS_ORIGIN=https://hvlab.app
FRONTEND_URL=https://hvlab.app
COOLSMS_API_KEY=NCSAOUKZWBK9ISKK
COOLSMS_API_SECRET=OUETIQGRMUWMWYYU4KKJMCROBLPMSNMB
COOLSMS_FROM_NUMBER=01074088864

## 설정 완료 후 확인

Railway 로그에서 다음 메시지 확인:
- Port configuration: 8080
- CORS Origin: https://hvlab.app
- Environment: production
