# 오픈뱅킹 API 연동 설정 가이드

## 1단계: 오픈뱅킹 포털 가입

### 1.1 회원가입
1. https://www.openbanking.or.kr 접속
2. [이용기관 등록하기] 클릭
3. 사업자 정보 입력
   - 사업자등록번호
   - 대표자 정보
   - 사업장 주소
   - 담당자 정보

### 1.2 필요 서류
- 사업자등록증 사본
- 대표자 신분증 사본
- 통장 사본 (정산 계좌)
- 서비스 계획서 (간단한 형식)

## 2단계: 테스트베드 신청

### 2.1 테스트베드 가입
1. 오픈뱅킹 포털 로그인
2. [이용기관 관리] > [테스트베드 신청]
3. 서비스 정보 입력
   - 서비스명: HV LAB 인테리어 관리 시스템
   - 서비스 URL: https://hvlab.app
   - Redirect URI: https://hvlab.app/api/banking/auth/callback

### 2.2 Client ID/Secret 발급
- 신청 승인 후 자동 발급 (약 1-2일 소요)
- 포털의 [앱 관리]에서 확인 가능

## 3단계: 회사 계좌 등록

### 3.1 출금 계좌 등록
1. 오픈뱅킹 포털 > [출금이체 관리]
2. [계좌 등록하기] 클릭
3. 회사 계좌 정보 입력
   - 은행명
   - 계좌번호
   - 예금주명 (사업자명)
4. 1원 인증 완료

### 3.2 Fintech 이용번호 발급
- 계좌 등록 승인 후 자동 발급
- 이 번호를 `.env`의 `COMPANY_FINTECH_USE_NUM`에 입력

## 4단계: 환경 변수 설정

`.env` 파일 생성 (`.env.example` 참고):

```env
# 오픈뱅킹 API
OPENBANKING_API_URL=https://testapi.openbanking.or.kr
OPENBANKING_CLIENT_ID=여기에_발급받은_Client_ID_입력
OPENBANKING_CLIENT_SECRET=여기에_발급받은_Client_Secret_입력
OPENBANKING_REDIRECT_URI=https://hvlab.app/api/banking/auth/callback
OPENBANKING_INSTITUTION_CODE=여기에_발급받은_9자리_기관코드_입력

# 회사 계좌
COMPANY_FINTECH_USE_NUM=여기에_발급받은_Fintech_이용번호_입력
COMPANY_ACCOUNT_HOLDER=HV LAB
COMPANY_BANK_CODE=004
COMPANY_ACCOUNT_NO=123456789012

# 암호화 키 (32자 이상 무작위 문자열)
ENCRYPTION_KEY=abcdefghijklmnopqrstuvwxyz123456
```

## 5단계: 테스트

### 5.1 로컬 테스트
```bash
# 서버 실행
npm run dev

# 다른 터미널에서 테스트
curl http://localhost:3000/api/banking/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5.2 오픈뱅킹 연동 테스트
1. 관리자 계정으로 로그인
2. 설정 페이지 접속
3. [오픈뱅킹 연동하기] 버튼 클릭
4. 오픈뱅킹 인증 페이지에서 본인 계좌 인증
5. 콜백 처리 확인

### 5.3 송금 테스트
1. 결제 요청 생성 (소액으로 테스트 권장)
2. [즉시송금] 버튼 클릭
3. 확인 팝업에서 정보 확인
4. 송금 실행
5. 송금 완료 확인

## 6단계: 상용 전환

### 6.1 상용 서비스 신청
1. 테스트 완료 후 오픈뱅킹 포털에서 신청
2. 심사 기간: 약 1-2주
3. 승인 후 상용 Client ID/Secret 재발급

### 6.2 환경 변수 업데이트
```env
OPENBANKING_API_URL=https://openapi.openbanking.or.kr
OPENBANKING_CLIENT_ID=상용_Client_ID
OPENBANKING_CLIENT_SECRET=상용_Client_Secret
NODE_ENV=production
```

### 6.3 배포
```bash
git add .
git commit -m "Update to production OpenBanking credentials"
git push
```

## 보안 주의사항

### 필수 보안 조치
1. **.env 파일 보안**
   - `.gitignore`에 추가되어 있는지 확인
   - 절대 GitHub에 업로드하지 말 것

2. **HTTPS 사용**
   - Redirect URI는 반드시 HTTPS여야 함
   - Railway는 자동으로 HTTPS 제공

3. **토큰 관리**
   - Access Token은 암호화하여 DB 저장
   - Refresh Token으로 자동 갱신
   - 만료된 토큰은 즉시 삭제

4. **IP 제한** (선택사항)
   - 오픈뱅킹 포털에서 허용 IP 설정 가능
   - 서버 IP 변경 시 업데이트 필요

5. **거래 한도 설정**
   - 오픈뱅킹 포털에서 1회/1일 한도 설정
   - 이상 거래 감지 시 알림 설정

## 문제 해결

### 인증 실패
- Client ID/Secret 확인
- Redirect URI가 정확한지 확인
- 테스트베드/상용 URL 일치 확인

### 송금 실패
- Fintech 이용번호 확인
- 은행 코드 확인 (bankCodes.ts)
- 계좌번호 형식 확인
- 잔액 부족 확인
- 거래 한도 초과 확인

### 토큰 만료
- Refresh Token으로 자동 갱신됨
- 갱신 실패 시 재인증 필요

## 비용

### 테스트베드
- 무료

### 상용 서비스
- 월 기본료: 50,000원
- 거래 수수료: 건당 20원
- 예시: 월 100건 = 50,000원 + 2,000원 = 52,000원

## 지원

### 오픈뱅킹 고객센터
- 전화: 1577-5500
- 이메일: support@openbanking.or.kr
- 운영시간: 평일 09:00-18:00

### 개발자 커뮤니티
- https://developers.openbanking.or.kr
- FAQ 및 샘플 코드 제공
