# Railway 배포 가이드

## 현재 설정

### 프론트엔드 (hvlab.app)

프로젝트 루트의 설정 파일들이 프론트엔드 배포를 위해 설정되었습니다:

1. **railway.json**
   - `root: "frontend"` - 프론트엔드 디렉토리를 루트로 지정
   - 빌더: NIXPACKS 사용

2. **nixpacks.toml**
   - Node.js 20 사용
   - 빌드: `cd frontend && npm run build`
   - 시작: `cd frontend && npm start`
   - 환경: NODE_ENV=production

3. **.railwayignore**
   - backend/ 폴더 제외
   - 문서 파일들 제외

### 백엔드 (별도 서비스 필요)

백엔드 API를 위해 Railway에서 별도의 서비스를 생성해야 합니다:

1. Railway 대시보드에서 새 서비스 추가
2. 같은 GitHub 리포지토리 연결
3. 서비스 설정에서 Root Directory를 `backend`로 설정
4. 커스텀 도메인 추가: `api.hvlab.app`

## Railway 설정 방법

### 1. 프론트엔드 서비스 (메인)

Railway 대시보드에서:
1. Settings 탭으로 이동
2. Root Directory 설정 확인 (자동으로 frontend로 설정되어야 함)
3. Environment Variables 추가:
   ```
   VITE_API_URL=https://api.hvlab.app
   ```

### 2. 백엔드 서비스 생성

1. Railway 프로젝트에서 "+ New" → "GitHub Repo" 클릭
2. 같은 리포지토리 선택
3. 서비스 이름을 "backend-api"로 변경
4. Settings에서:
   - Root Directory: `backend`
   - Build Command: `npm run build` (필요시)
   - Start Command: `npm start`
5. Environment Variables 추가:
   ```
   NODE_ENV=production
   DATABASE_URL=[데이터베이스 URL]
   JWT_SECRET=[시크릿 키]
   ```
6. Networking 탭에서 커스텀 도메인 추가: `api.hvlab.app`

## 배포 확인

1. **프론트엔드 확인**
   - https://hvlab.app 접속
   - 리액트 앱이 정상 로드되는지 확인

2. **백엔드 확인**
   - https://api.hvlab.app/health 접속 (health 엔드포인트가 있다면)
   - API가 정상 응답하는지 확인

## 트러블슈팅

### 프론트엔드가 아직도 백엔드를 보여주는 경우

1. Railway 대시보드에서 배포 로그 확인
2. Build Logs에서 "cd frontend && npm run build" 실행 확인
3. Deploy Logs에서 serve가 dist 폴더를 서빙하는지 확인
4. 캐시 문제일 수 있으니 Railway에서 "Redeploy" 클릭

### API 연결 안 되는 경우

1. 프론트엔드의 환경 변수 VITE_API_URL 확인
2. 백엔드 서비스가 실행 중인지 확인
3. CORS 설정 확인

## 로컬 개발

로컬에서 테스트할 때:

```bash
# 프론트엔드
cd frontend
npm run dev

# 백엔드 (별도 터미널)
cd backend
npm run dev
```