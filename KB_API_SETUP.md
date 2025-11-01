# KB국민은행 API 연동 설정 가이드

## 📋 준비사항

### 1. KB API 포털 가입 및 앱 등록
1. [KB API 포털](https://apiportal.kbfg.com) 접속
2. 회원가입 및 로그인
3. "My App" → "앱 등록"
4. 앱 정보 입력:
   - 앱 이름: HV LAB 관리시스템
   - 앱 설명: 내부 결제 관리 시스템
   - Redirect URI: `https://hvlab.app/api/banking/kb-oauth/callback`
   - 권한 요청: `transfer`, `inquiry`, `account`

### 2. API 키 발급
1. 앱 등록 완료 후 "API Key" 메뉴에서 확인
2. Client ID와 Client Secret 메모
3. JWT 토큰 발급 (API 포털에서 제공)

## ⚙️ 환경 변수 설정

`.env` 파일에 다음 내용을 추가하세요:

```env
# KB OAuth 2.0 설정
KB_OAUTH_CLIENT_ID=your_client_id_here
KB_OAUTH_CLIENT_SECRET=your_client_secret_here
KB_OAUTH_REDIRECT_URI=https://hvlab.app/api/banking/kb-oauth/callback

# KB API URLs
KB_AUTH_URL=https://apiportal.kbfg.com/sampledata/101306/1/v1
KB_API_URL=https://apiportal.kbfg.com/api

# KB JWT Token (API 포털에서 발급)
KB_JWT_TOKEN=your_jwt_token_here

# 토큰 암호화 키 (32바이트 랜덤 문자열)
ENCRYPTION_KEY=your_32_byte_encryption_key_here

# 기존 KB 설정 (선택사항 - 기업뱅킹 사용시)
KB_CLIENT_ID=your_corporate_client_id
KB_CLIENT_SECRET=your_corporate_client_secret
KB_COMPANY_ACCOUNT=1234567890
KB_COMPANY_ACCOUNT_HOLDER=HV LAB
```

## 🔐 보안 주의사항

1. **절대로 API 키를 GitHub에 커밋하지 마세요**
2. `.env` 파일은 `.gitignore`에 포함되어 있어야 합니다
3. Railway 환경변수에 동일한 값을 설정해야 합니다

## 🚀 Railway 환경변수 설정

1. Railway 대시보드 접속
2. HV LAB 프로젝트 선택
3. "Variables" 탭 클릭
4. 위의 환경변수들을 하나씩 추가:
   ```
   KB_OAUTH_CLIENT_ID = [발급받은 Client ID]
   KB_OAUTH_CLIENT_SECRET = [발급받은 Client Secret]
   KB_JWT_TOKEN = [발급받은 JWT Token]
   ... (나머지 변수들)
   ```
5. 저장 후 자동 재배포 대기

## 💡 사용 방법

### 1. 최초 인증 (관리자만 가능)
1. 설정 페이지에서 "KB 은행 연동" 버튼 클릭
2. KB 로그인 페이지로 이동
3. 공동인증서 또는 간편인증 로그인
4. 권한 동의
5. 자동으로 설정 페이지로 리다이렉트

### 2. 즉시송금 사용
1. 결제요청 관리 페이지에서 결제 대기 항목 확인
2. "즉시송금" 버튼 클릭
3. 출금계좌 선택 (KB 계좌만 가능)
4. 송금 확인
5. 자동으로 결제 완료 처리

## 📱 API 엔드포인트

### OAuth 인증
- **시작**: `GET /api/banking/kb-oauth/start`
- **콜백**: `GET /api/banking/kb-oauth/callback`

### 송금 기능
- **즉시송금**: `POST /api/banking/kb-instant-transfer`
- **계좌확인**: `POST /api/banking/kb-verify-account`

## 🔍 트러블슈팅

### 인증 실패
- Client ID/Secret 확인
- Redirect URI 일치 여부 확인
- JWT 토큰 만료 확인

### 송금 실패
- 잔액 부족 확인
- 일일/1회 이체한도 확인
- 수취인명 일치 여부 확인

### 토큰 만료
- 자동으로 Refresh Token으로 갱신
- 갱신 실패시 재인증 필요

## 📞 문의

KB API 관련 문의:
- KB API 포털 고객센터: 1588-9999
- 기술지원: api@kbfg.com

시스템 관련 문의:
- HV LAB 개발팀

---
작성일: 2024-11-01