# Railway 웹 대시보드로 hvlab.app 배포하기

## 🚀 가장 쉬운 배포 방법 (웹 브라우저 사용)

### 준비물
- GitHub 계정
- Railway 계정 (무료)
- hvlab.app 도메인 (Porkbun)

---

## 📋 Step 1: GitHub에 코드 업로드 (5분)

### 1-1. GitHub 저장소 생성

1. https://github.com 접속 및 로그인
2. 우측 상단 **+** 버튼 클릭 → **New repository**
3. Repository 정보 입력:
   - **Repository name**: `interior-management-system`
   - **Public** 또는 **Private** 선택
   - **Create repository** 클릭

### 1-2. 로컬 코드를 GitHub에 푸시

터미널에서 실행:

```bash
# 프로젝트 폴더로 이동
cd "C:\Users\kim_s\Desktop\HV LAB app\interior-management-system"

# Git 초기화 (아직 안했다면)
git init

# .gitignore 파일이 없다면 생성
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
echo "dist/" >> .gitignore
echo ".DS_Store" >> .gitignore

# 모든 파일 추가
git add .

# 커밋
git commit -m "Initial commit"

# GitHub 저장소 연결 (YOUR_USERNAME을 본인 GitHub 아이디로 변경)
git remote add origin https://github.com/YOUR_USERNAME/interior-management-system.git

# 푸시
git branch -M main
git push -u origin main
```

---

## 🚂 Step 2: Railway에 백엔드 배포 (3분)

### 2-1. Railway 계정 생성

1. https://railway.app 접속
2. **Login** 클릭 → GitHub로 로그인
3. Railway 대시보드로 이동

### 2-2. 새 프로젝트 생성 - 백엔드

1. **New Project** 클릭
2. **Deploy from GitHub repo** 선택
3. `interior-management-system` 저장소 선택
4. **Add variables** 클릭하여 환경 변수 추가:

```
NODE_ENV=production
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string
CORS_ORIGIN=https://hvlab.app
```

5. **Settings** 탭:
   - **Root Directory**: `backend` 입력
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

6. **Deploy** 클릭

### 2-3. MongoDB 추가

1. 백엔드 프로젝트에서 **+ New** 클릭
2. **Database** 선택 → **Add MongoDB**
3. MongoDB가 자동으로 생성되고 `MONGODB_URI` 환경 변수가 자동 추가됨

### 2-4. 백엔드 도메인 확인

1. **Settings** → **Networking** → **Public Networking**
2. **Generate Domain** 클릭
3. 생성된 도메인 복사 (예: `your-backend.up.railway.app`)

---

## 🎨 Step 3: Railway에 프론트엔드 배포 (3분)

### 3-1. 새 프로젝트 생성 - 프론트엔드

1. Railway 대시보드에서 **New Project** 클릭
2. **Deploy from GitHub repo** 선택
3. `interior-management-system` 저장소 선택
4. **Add variables** 클릭:

```
VITE_API_URL=https://api.hvlab.app
VITE_SOCKET_URL=https://api.hvlab.app
VITE_APP_NAME=Interior Management System
VITE_APP_VERSION=1.0.0
```

5. **Settings** 탭:
   - **Root Directory**: `frontend` 입력
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx serve -s dist -l $PORT`

6. **Deploy** 클릭

### 3-2. 프론트엔드 도메인 확인

1. **Settings** → **Networking** → **Public Networking**
2. **Generate Domain** 클릭
3. 생성된 도메인 복사 (예: `your-frontend.up.railway.app`)

---

## 🌐 Step 4: Porkbun DNS 설정 (2분)

### 4-1. Porkbun 로그인 및 DNS 설정

1. https://porkbun.com 로그인
2. **Account** → **Domain Management** → **hvlab.app** 클릭
3. **DNS Records** 섹션으로 스크롤

### 4-2. DNS 레코드 추가

**메인 도메인 (hvlab.app) - 프론트엔드:**

```
Type: CNAME
Host: @
Answer: your-frontend.up.railway.app
TTL: 600
```

**API 도메인 (api.hvlab.app) - 백엔드:**

```
Type: CNAME
Host: api
Answer: your-backend.up.railway.app
TTL: 600
```

4. **Submit** 또는 **Save** 클릭

---

## 🔗 Step 5: Railway에서 커스텀 도메인 연결 (2분)

### 5-1. 백엔드 프로젝트

1. Railway 백엔드 프로젝트 선택
2. **Settings** → **Networking** → **Custom Domains**
3. `api.hvlab.app` 입력 후 **Add**
4. SSL 인증서 자동 발급 대기 (2~5분)

### 5-2. 프론트엔드 프로젝트

1. Railway 프론트엔드 프로젝트 선택
2. **Settings** → **Networking** → **Custom Domains**
3. `hvlab.app` 입력 후 **Add**
4. SSL 인증서 자동 발급 대기 (2~5분)

---

## ✅ Step 6: 테스트 및 확인

### 6-1. DNS 전파 확인 (10~30분 소요)

브라우저에서 확인:
- https://hvlab.app
- https://api.hvlab.app/health

DNS가 아직 전파되지 않았다면:
- https://www.whatsmydns.net 에서 확인
- 또는 Railway 임시 도메인으로 먼저 테스트

### 6-2. 기능 테스트

- [ ] 프론트엔드 정상 로드
- [ ] 대시보드 페이지 접속
- [ ] 프로젝트 관리 페이지
- [ ] 일정 관리 캘린더
- [ ] 결제 요청 기능
- [ ] API 연결 확인

---

## 💰 비용 안내

### Railway 무료 티어
- **월 $5 크레딧** 제공
- **2개 서비스** (프론트엔드 + 백엔드)
- **MongoDB 포함**

### 예상 월 사용량
- 프론트엔드: ~$3
- 백엔드: ~$3
- MongoDB: ~$2
- **총: ~$8/월**

⚠️ 무료 크레딧 $5 초과 시 결제 필요

### 비용 절약 팁
1. 개발/테스트 환경은 로컬에서 사용
2. 사용하지 않을 때 서비스 중지
3. 트래픽이 적은 초기에는 무료 티어로 충분

---

## 🔄 업데이트 배포

코드 변경 후 자동 배포:

```bash
cd "C:\Users\kim_s\Desktop\HV LAB app\interior-management-system"

git add .
git commit -m "Update features"
git push origin main
```

Railway가 자동으로 감지하고 재배포합니다!

---

## 🆘 문제 해결

### DNS가 연결되지 않을 때
1. Porkbun에서 DNS 레코드 재확인
2. Railway Custom Domains에서 도메인 상태 확인
3. 24시간 대기 (최대 48시간)

### 배포 실패 시
1. Railway 프로젝트 → **Deployments** 탭
2. 실패한 배포 클릭 → 로그 확인
3. 에러 메시지 기반으로 수정

### MongoDB 연결 실패
1. Railway에서 MongoDB 플러그인 추가되었는지 확인
2. 환경 변수 `MONGODB_URI` 자동 생성되었는지 확인

---

## 📞 도움말

- Railway 문서: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Porkbun 지원: https://porkbun.com/support

---

## ✨ 배포 완료!

축하합니다! 🎉

이제 다음 URL에서 접속 가능합니다:
- **프론트엔드**: https://hvlab.app
- **백엔드 API**: https://api.hvlab.app

모든 기능이 정상 작동하는지 확인하세요!
