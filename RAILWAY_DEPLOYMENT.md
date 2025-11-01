# Railway 배포 설정 가이드

## 개요
이 프로젝트는 Railway를 통해 hvlab.app 도메인으로 직접 배포됩니다.
로컬 개발 시 여러 포트를 사용하던 것과 달리, Railway에서는 단일 포트로 모든 서비스를 제공합니다.

## Railway 환경 변수 설정

Railway 대시보드에서 다음 환경 변수들을 설정해야 합니다:

1. **Railway 대시보드에 로그인**
   - https://railway.app 접속
   - HV_WORKS 프로젝트 선택

2. **Variables 탭에서 환경 변수 추가**

```env
# 필수 환경 변수
NODE_ENV=production
CORS_ORIGIN=https://hvlab.app
JWT_SECRET=[보안 키]
DATABASE_PATH=/app/data/database.db

# Google API (지도 서비스)
GOOGLE_API_KEY=[Google API 키]

# Kakao Map API
KAKAO_MAP_API_KEY=[Kakao API 키]

# 이메일 설정 (Gmail)
EMAIL_USER=[이메일 주소]
EMAIL_PASSWORD=[앱 비밀번호]
EMAIL_FROM=[발신자 이메일]

# SMS 설정 (Solapi)
SOLAPI_API_KEY=[Solapi API 키]
SOLAPI_API_SECRET=[Solapi Secret]
SOLAPI_PF_ID=[Solapi PF ID]
SOLAPI_SENDER=[발신 전화번호]
```

## 배포 방법

### 방법 1: 자동 배포 스크립트 사용
```bash
# Windows
deploy-railway.bat

# 또는 npm 스크립트 사용
npm run deploy
```

### 방법 2: 수동 배포
```bash
# 1. 변경사항 커밋
git add .
git commit -m "Your commit message"

# 2. GitHub에 푸시
git push

# 3. Railway에 배포
railway up
```

### 방법 3: GitHub 자동 배포
- GitHub 리포지토리에 푸시하면 Railway가 자동으로 감지하여 배포
- main 브랜치에 푸시 시 자동 배포 실행

## 포트 설정

### Railway 환경
- Railway는 자동으로 포트를 할당하고 `PORT` 환경 변수로 제공
- server.js는 `process.env.PORT || 3000`으로 설정되어 있어 자동 적응
- 외부에서는 https://hvlab.app으로 접근 (포트 번호 불필요)

### 로컬 개발 환경
```bash
# 개발 서버 실행
npm run dev

# 로컬에서는 http://localhost:3000으로 접근
```

## 도메인 설정

1. **Railway 대시보드에서 Settings 탭**
2. **Domains 섹션**
3. **Custom Domain 추가**
   - hvlab.app 입력
4. **DNS 설정** (도메인 제공업체에서)
   - CNAME 레코드: hvlab.app → [Railway 제공 도메인]
   - 또는 A 레코드: Railway 제공 IP 주소

## 데이터베이스 관리

### Railway Volume 설정
```bash
# Volume이 없는 경우 생성
railway volume create database-volume

# 데이터베이스 백업 업로드
railway volume upload database-backup.db /app/data/database.db
```

### 데이터베이스 경로
- Railway: `/app/data/database.db`
- 로컬: `./database.db`

## 로그 확인

```bash
# 실시간 로그 확인
railway logs

# 최근 100줄 로그
railway logs --lines 100
```

## 문제 해결

### 배포 실패 시
1. Railway 대시보드에서 Build Logs 확인
2. 환경 변수 설정 확인
3. package.json의 node 버전 확인

### 데이터베이스 연결 실패
1. DATABASE_PATH 환경 변수 확인
2. Volume이 올바르게 마운트되었는지 확인

### CORS 에러
1. CORS_ORIGIN 환경 변수가 https://hvlab.app로 설정되었는지 확인
2. 프론트엔드에서 API 호출 시 올바른 URL 사용 확인

## 장점

1. **단순화된 구조**
   - 로컬의 여러 포트 대신 단일 포트 사용
   - 프록시 설정 불필요

2. **자동 SSL**
   - Railway가 자동으로 HTTPS 인증서 관리

3. **자동 스케일링**
   - 트래픽에 따라 자동으로 리소스 조정

4. **간편한 롤백**
   - Railway 대시보드에서 이전 버전으로 쉽게 롤백 가능

## 유용한 명령어

```bash
# Railway 프로젝트 상태 확인
railway status

# 환경 변수 목록 확인
railway variables

# 서비스 재시작
railway restart

# 로그 확인
railway logs --tail

# 배포 히스토리 확인
railway deployments
```