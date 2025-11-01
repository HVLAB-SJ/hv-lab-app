# HV LAB APP - 배포 가이드

## 📁 프로젝트 구조

```
HV LAB app/
├── frontend-source/             # 프론트엔드 소스 코드
│   └── interior-management-system/
│       └── frontend/
│           ├── src/             # React 소스
│           └── dist/            # 빌드 결과 (임시)
├── public/                      # ⭐ 배포용 프론트엔드 파일 (중요!)
│   ├── index.html
│   ├── assets/                  # JS, CSS 파일
│   └── ...                      # 기타 정적 파일
├── server/                      # 백엔드 서버 코드
├── server.js                    # 메인 서버 파일
└── build-and-deploy.bat         # 자동 빌드/배포 스크립트
```

## ⚠️ 중요 규칙

### ✅ 올바른 방법
1. **프론트엔드 수정** → `frontend-source/` 폴더에서 작업
2. **빌드** → `npm run build` 실행
3. **배포 파일 복사** → 빌드 결과를 `public/` 폴더로 복사
4. **배포** → Git commit & push → Railway 자동 배포

### ❌ 잘못된 방법
- 루트 디렉토리에 직접 파일 복사 ❌
- `assets/` 폴더를 루트에 생성 ❌
- index.html을 루트에 복사 ❌

## 🚀 배포 방법

### 방법 1: 자동 스크립트 사용 (권장)
```bash
# Windows에서 실행
build-and-deploy.bat
```

### 방법 2: 수동 배포
```bash
# 1. 프론트엔드 빌드
cd frontend-source/interior-management-system/frontend
npm run build

# 2. public 폴더 정리
cd ../../..
rm -rf public/*

# 3. 빌드 파일 복사
cp -r frontend-source/interior-management-system/frontend/dist/* public/

# 4. Git 커밋 & 푸시
git add -A
git commit -m "Deploy frontend updates"
git push origin main

# 5. Railway 배포
railway up --service hv-lab-app
```

## 📝 서버 설정

server.js는 다음과 같이 설정되어 있습니다:
- **정적 파일**: `public/` 폴더에서만 제공
- **API 경로**: `/api/*`
- **SPA 라우팅**: 모든 non-API 요청은 `public/index.html`로

## 🔍 문제 해결

### 프론트엔드가 안 보일 때
1. `public/` 폴더에 파일이 있는지 확인
2. `public/index.html`이 있는지 확인
3. Railway 로그 확인: `railway logs --service hv-lab-app`

### API가 작동하지 않을 때
1. 서버 로그 확인
2. `/api/health` 엔드포인트 테스트
3. CORS 설정 확인

## 🌐 접속 주소
- **Production**: https://hvlab.app
- **API**: https://hvlab.app/api

## 📌 기억할 점
> **"모든 프론트엔드 빌드 파일은 반드시 `public/` 폴더에만 있어야 합니다!"**

---
작성일: 2024-11-01