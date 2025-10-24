# KB API 포털 가입 및 설정 가이드
https://apiportal.kbfg.com/

## 1단계: 회원가입

### 1.1 포털 접속
1. https://apiportal.kbfg.com/ 접속
2. 우측 상단 **[회원가입]** 클릭

### 1.2 회원 유형 선택
- **기업회원** 선택 (개인사업자도 기업회원으로 가입)
- 개인회원은 테스트만 가능

### 1.3 필수 정보 입력
```
- 사업자등록번호
- 회사명
- 대표자명
- 사업장 주소
- 담당자 이름
- 담당자 이메일
- 담당자 전화번호
- 아이디 생성
- 비밀번호 설정
```

### 1.4 이메일 인증
- 입력한 이메일로 인증 메일 발송
- 인증 링크 클릭하여 완료

---

## 2단계: 로그인 및 API 신청

### 2.1 로그인
1. https://apiportal.kbfg.com/ 접속
2. 생성한 아이디/비밀번호로 로그인

### 2.2 API 상품 선택
1. 상단 메뉴 **[API 상품]** 클릭
2. 검색창에 **"이체"** 또는 **"계좌이체"** 검색
3. **"KB 계좌이체 API"** 선택

### 2.3 API 구독 신청
1. API 상세 페이지에서 **[구독하기]** 버튼 클릭
2. 구독 정보 입력:
   ```
   - 서비스명: HV LAB 인테리어 관리 시스템
   - 서비스 설명: 자사 직원 결제 요청 자동 송금 시스템
   - 예상 트래픽: 월 100건 (실제 예상 건수 입력)
   - 용도: 내부 시스템 연동
   - 운영환경: Production (상용) 또는 Development (개발)
   ```

### 2.4 약관 동의
- KB API 이용약관 동의
- 개인정보 처리방침 동의
- **[신청하기]** 클릭

---

## 3단계: 앱(App) 생성

### 3.1 내 앱 관리
1. 상단 메뉴 **[내 정보]** → **[내 앱 관리]** 클릭
2. **[새 앱 추가]** 버튼 클릭

### 3.2 앱 정보 입력
```
앱 이름: HV LAB Transfer System
앱 설명: HV LAB 인테리어 관리 시스템 자동 송금 앱
Redirect URI: https://hvlab.app/api/banking/kb/callback
  (개발 시: http://localhost:3000/api/banking/kb/callback)
```

### 3.3 API 권한 설정
- **계좌 조회** 권한 선택 ✅
- **계좌 이체** 권한 선택 ✅
- **[저장]** 클릭

### 3.4 Client ID / Secret 발급
- 앱 생성 완료 후 자동 발급
- **Client ID**: 앱 상세에서 확인 가능 (공개 가능)
- **Client Secret**: **[시크릿 보기]** 클릭 (절대 공개 금지!)
- 📋 **반드시 복사해서 안전한 곳에 보관!**

---

## 4단계: 테스트 환경 설정

### 4.1 샌드박스 계좌 발급
1. **[내 정보]** → **[테스트 계좌]** 메뉴
2. **[테스트 계좌 생성]** 클릭
3. 가상 계좌번호 발급받음 (테스트용)

### 4.2 테스트 토큰 발급
```javascript
// 테스트 환경
const testConfig = {
  apiUrl: 'https://apitest.kbfg.com', // 테스트 URL
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET'
};
```

### 4.3 API 테스트
1. 포털에서 **[API 테스트]** 메뉴 선택
2. 발급받은 Client ID/Secret 입력
3. 샌드박스 계좌로 테스트 송금
4. 정상 작동 확인

---

## 5단계: 상용 계좌 등록

### 5.1 실계좌 인증 필요
⚠️ **중요: 실제 계좌는 KB 영업점 방문 필요**

실제 회사 계좌로 송금하려면:
1. **KB국민은행 영업점 방문**
2. 기업 인터넷뱅킹 가입
3. API 서비스 신청
4. 실계좌와 API 연동 신청

### 5.2 계좌 연동 절차
1. 영업점에서 **"API 포털 계정"** 알려주기
2. 담당자가 **회사 계좌**와 **API 앱** 연결
3. 1-2일 후 승인 완료
4. 포털에서 연동된 계좌 확인 가능

---

## 6단계: 환경 변수 설정

### 6.1 개발 환경 (.env.local)
```env
# KB API 포털 설정 (테스트)
KB_API_URL=https://apitest.kbfg.com
KB_CLIENT_ID=발급받은_Client_ID
KB_CLIENT_SECRET=발급받은_Client_Secret
KB_COMPANY_ACCOUNT=테스트계좌번호
KB_COMPANY_ACCOUNT_HOLDER=회사명
```

### 6.2 상용 환경 (Railway)
```env
# KB API 포털 설정 (상용)
KB_API_URL=https://api.kbfg.com
KB_CLIENT_ID=발급받은_Client_ID
KB_CLIENT_SECRET=발급받은_Client_Secret
KB_COMPANY_ACCOUNT=실제회사계좌번호
KB_COMPANY_ACCOUNT_HOLDER=회사명
```

---

## 7단계: 코드 수정

현재 구현된 코드를 KB API 포털 형식에 맞게 약간 수정 필요:

### 7.1 API URL 업데이트
```javascript
// server/services/kbBankService.js 수정
constructor() {
  // KB API 포털 엔드포인트
  this.apiUrl = process.env.KB_API_URL || 'https://api.kbfg.com';

  // 나머지는 동일...
}
```

### 7.2 인증 헤더 형식
KB API 포털은 표준 OAuth 2.0 사용:
```javascript
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'x-client-id': this.clientId  // KB 포털 전용 헤더
}
```

---

## 실제 API 엔드포인트 (KB 포털)

### 1. 토큰 발급
```
POST https://api.kbfg.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&scope=transfer inquiry
```

### 2. 계좌 이체
```
POST https://api.kbfg.com/v1/transfer/withdraw
Authorization: Bearer {ACCESS_TOKEN}
x-client-id: {CLIENT_ID}

{
  "accountNumber": "12345678901",
  "toBank": "004",
  "toAccount": "98765432109",
  "toName": "홍길동",
  "amount": 10000,
  "memo": "결제대금"
}
```

### 3. 잔액 조회
```
GET https://api.kbfg.com/v1/account/balance?accountNumber=12345678901
Authorization: Bearer {ACCESS_TOKEN}
x-client-id: {CLIENT_ID}
```

---

## 비용 안내

### KB API 포털 요금제

| 항목 | 무료 플랜 | 스타트업 | 비즈니스 |
|------|-----------|----------|----------|
| 가입비 | **0원** | 0원 | 0원 |
| 월 이용료 | **0원** | **0원** | 50,000원 |
| API 호출 | 월 100건 | 월 1,000건 | 무제한 |
| 송금 수수료 | 이체 수수료만 | 이체 수수료만 | 이체 수수료만 |
| 지원 | 커뮤니티 | 이메일 | 전화 |

**추천: 무료 플랜으로 시작!**
- 월 100건까지 완전 무료
- KB→KB 이체 시 수수료도 무료
- 충분하면 계속 무료로 사용

---

## 문제 해결

### "구독 신청이 거부되었습니다"
- 사업자등록증 확인 필요
- KB 고객센터 문의: 1588-9999

### "테스트 계좌가 생성되지 않습니다"
- 회원 승인 대기 중일 수 있음
- 24시간 내 자동 승인됨

### "실계좌 연동이 안됩니다"
- 반드시 영업점 방문 필요
- 온라인으로는 테스트만 가능

---

## 단계별 체크리스트

### ✅ 온라인 가능 (지금 바로)
- [ ] KB API 포털 회원가입
- [ ] 로그인
- [ ] API 구독 신청
- [ ] 앱 생성
- [ ] Client ID/Secret 발급
- [ ] 테스트 계좌 생성
- [ ] 샌드박스 테스트

### ⚠️ 영업점 방문 필요 (실제 사용)
- [ ] KB 영업점 방문
- [ ] 기업 인터넷뱅킹 가입
- [ ] 실계좌-API 연동 신청
- [ ] 승인 대기 (1-2일)
- [ ] 상용 환경 테스트

---

## 지금 바로 시작하기

1. **https://apiportal.kbfg.com/ 접속**
2. **회원가입** (기업회원)
3. **로그인** → API 상품 → **계좌이체 API 구독**
4. **내 앱 관리** → 새 앱 추가
5. **Client ID/Secret 복사**
6. **환경 변수 설정**
7. **테스트 실행**

**테스트는 지금 바로 가능합니다!**
영업점 방문은 테스트 완료 후에 하시면 됩니다.

---

## 도움말

### KB API 포털 고객센터
- 전화: 1588-9999 (업무시간 내)
- 이메일: openapi@kbfg.com
- 포털 내 1:1 문의

### 개발자 커뮤니티
- https://apiportal.kbfg.com/community
- FAQ 및 샘플 코드 제공
- 다른 개발자들과 정보 공유

필요하시면 각 단계마다 도와드리겠습니다!
