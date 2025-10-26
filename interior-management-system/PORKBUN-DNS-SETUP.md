# Porkbun DNS 설정 가이드 (hvlab.app)

## 🌐 1. Porkbun DNS 레코드 설정

### 방법 1: Vercel + Railway 배포 (가장 간단)

#### Step 1: Vercel에 프론트엔드 배포

1. **Vercel 계정 생성 및 프로젝트 배포**
   ```bash
   # Vercel CLI 설치
   npm install -g vercel

   # 프론트엔드 폴더로 이동
   cd "C:\Users\kim_s\Desktop\HV LAB app\interior-management-system\frontend"

   # Vercel 로그인 및 배포
   vercel login
   vercel
   ```

2. **Vercel에서 제공하는 도메인 정보 확인**
   - 배포 완료 후 Vercel 대시보드 접속
   - Settings > Domains 메뉴
   - Vercel이 제공하는 CNAME 값 확인 (예: cname.vercel-dns.com)

#### Step 2: Railway에 백엔드 배포

1. **Railway 프로젝트 생성**
   ```bash
   # Railway CLI 설치
   npm install -g @railway/cli

   # 백엔드 폴더로 이동
   cd "C:\Users\kim_s\Desktop\HV LAB app\interior-management-system\backend"

   # Railway 로그인 및 배포
   railway login
   railway init
   railway up
   ```

2. **Railway 도메인 설정**
   - Railway 대시보드에서 배포된 프로젝트 선택
   - Settings > Networking > Public Networking
   - Generate Domain 클릭 (예: your-project.up.railway.app)

#### Step 3: Porkbun DNS 설정

Porkbun 웹사이트 (https://porkbun.com/) 로그인 후:

1. **Account > Domain Management > hvlab.app** 클릭
2. **DNS Records** 섹션에서 다음 레코드 추가:

**프론트엔드 (Vercel):**
```
Type: CNAME
Host: @ (또는 hvlab.app)
Answer: cname.vercel-dns.com (Vercel에서 제공한 값)
TTL: 600
```

**www 서브도메인 (선택사항):**
```
Type: CNAME
Host: www
Answer: cname.vercel-dns.com
TTL: 600
```

**백엔드 API (Railway):**
```
Type: CNAME
Host: api
Answer: your-project.up.railway.app (Railway에서 제공한 도메인)
TTL: 600
```

3. **Save Changes** 클릭

#### Step 4: Vercel에서 커스텀 도메인 추가

1. Vercel 대시보드 > 프로젝트 선택
2. Settings > Domains
3. "Add" 버튼 클릭
4. `hvlab.app` 입력 후 Add
5. `www.hvlab.app`도 추가 (선택사항)
6. Vercel이 자동으로 SSL 인증서 발급

#### Step 5: Railway에서 커스텀 도메인 추가

1. Railway 대시보드 > 프로젝트 선택
2. Settings > Networking
3. Custom Domains 섹션
4. `api.hvlab.app` 입력 후 Add

---

### 방법 2: VPS 서버에 직접 배포

서버 IP 주소가 있는 경우 (예: 123.456.789.012):

#### Porkbun DNS 레코드:

```
# 메인 도메인
Type: A
Host: @
Answer: 123.456.789.012
TTL: 600

# www 서브도메인
Type: A
Host: www
Answer: 123.456.789.012
TTL: 600

# API 서브도메인
Type: A
Host: api
Answer: 123.456.789.012
TTL: 600
```

---

## 🔧 2. SSL 인증서 자동 설정

### Vercel/Railway 사용 시
- **자동 설정됨** - 별도 작업 불필요

### VPS 서버 사용 시
서버에 접속 후 Let's Encrypt 인증서 설치:

```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d hvlab.app -d www.hvlab.app -d api.hvlab.app

# 이메일 입력 후 진행
# 자동으로 HTTPS 리다이렉트 설정됨
```

---

## ⏱️ 3. DNS 전파 대기

DNS 변경사항이 전파되는데 **5분~48시간** 소요될 수 있습니다.
보통 **10~30분** 내에 적용됩니다.

### DNS 전파 확인 방법:

```bash
# Windows PowerShell
nslookup hvlab.app
nslookup api.hvlab.app

# 또는 온라인 도구 사용
# https://www.whatsmydns.net/
```

---

## 📝 4. 환경 변수 업데이트

### Vercel 환경 변수 설정

1. Vercel 대시보드 > 프로젝트 선택
2. Settings > Environment Variables
3. 다음 변수 추가:

```
VITE_API_URL = https://api.hvlab.app
VITE_SOCKET_URL = https://api.hvlab.app
VITE_APP_NAME = Interior Management System
VITE_APP_VERSION = 1.0.0
```

4. **Redeploy** 버튼 클릭

### Railway 환경 변수 설정

1. Railway 대시보드 > 프로젝트 선택
2. Variables 탭
3. 다음 변수 추가:

```
NODE_ENV = production
PORT = 5000
JWT_SECRET = [강력한 랜덤 문자열]
CORS_ORIGIN = https://hvlab.app
MONGODB_URI = [Railway MongoDB 플러그인에서 자동 제공]
```

---

## ✅ 5. 테스트 및 확인

배포 완료 후 확인:

### 1. 도메인 접속 테스트
- https://hvlab.app - 프론트엔드 정상 작동 확인
- https://api.hvlab.app/health - 백엔드 API 확인

### 2. SSL 인증서 확인
- 브라우저 주소창에 자물쇠 아이콘 표시
- 인증서 정보 확인 (Let's Encrypt 또는 Vercel)

### 3. 기능 테스트
- 로그인 기능
- 데이터 저장/불러오기
- WebSocket 연결 (실시간 알림)

---

## 🚨 문제 해결

### DNS가 적용되지 않을 때

1. **Porkbun DNS 확인**
   - DNS Records가 올바르게 입력되었는지 확인
   - Nameservers가 Porkbun 기본값으로 설정되어 있는지 확인

2. **DNS 캐시 클리어**
   ```bash
   # Windows
   ipconfig /flushdns

   # Mac
   sudo dscacheutil -flushcache
   ```

3. **시크릿 모드로 접속**
   - 브라우저 캐시 문제 확인

### SSL 인증서 에러

1. **Vercel/Railway**
   - 도메인이 올바르게 인증되었는지 대시보드 확인
   - 24시간 대기 후 재시도

2. **VPS 서버**
   ```bash
   # Certbot 로그 확인
   sudo tail -f /var/log/letsencrypt/letsencrypt.log

   # Nginx 재시작
   sudo systemctl restart nginx
   ```

### CORS 에러

백엔드 환경 변수 확인:
```
CORS_ORIGIN = https://hvlab.app
```

---

## 📊 권장 배포 플랜

### 무료/저렴한 옵션 (시작 단계)

- **프론트엔드**: Vercel (무료)
- **백엔드**: Railway (월 $5, 무료 티어 $5 크레딧 제공)
- **데이터베이스**: Railway MongoDB 플러그인 (무료)

**총 비용: 월 $0~5**

### 프로덕션 옵션 (비즈니스 단계)

- **프론트엔드**: Vercel Pro (월 $20)
- **백엔드**: AWS EC2 t3.small (월 $15~20)
- **데이터베이스**: MongoDB Atlas M10 (월 $57)

**총 비용: 월 $92~97**

---

## 📞 도움이 필요하면

1. Vercel: https://vercel.com/docs
2. Railway: https://docs.railway.app
3. Porkbun Support: https://porkbun.com/support

---

## 🎯 다음 단계 체크리스트

- [ ] Vercel 계정 생성 및 프론트엔드 배포
- [ ] Railway 계정 생성 및 백엔드 배포
- [ ] Porkbun DNS 레코드 추가
- [ ] Vercel에서 hvlab.app 도메인 추가
- [ ] Railway에서 api.hvlab.app 도메인 추가
- [ ] 환경 변수 설정 (Vercel + Railway)
- [ ] SSL 인증서 자동 발급 확인
- [ ] 도메인 접속 테스트
- [ ] 기능 테스트 완료
