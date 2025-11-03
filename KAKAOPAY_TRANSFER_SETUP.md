# 카카오페이 즉시송금 연동 가이드

## 📋 개요
결제요청 페이지의 "즉시송금" 버튼에 카카오페이 송금 API가 연동되었습니다.

## 🔧 설정 방법

### 1. 카카오페이 비즈니스 계정 준비

#### 필요한 것
1. **카카오 개발자 계정**
   - https://developers.kakao.com 에서 계정 생성

2. **카카오페이 비즈니스 신청**
   - https://kakaopay.com/business 접속
   - 사업자 정보 등록
   - 송금 서비스 신청

3. **필수 서류**
   - 사업자등록증
   - 통장 사본
   - 대표자 신분증

#### 승인 기간
- 서류 심사: 3-5 영업일
- 송금 서비스 승인: 추가 5-7 영업일
- 총 소요 기간: 약 2주

### 2. API 키 발급

1. 카카오 개발자 콘솔 접속
2. 내 애플리케이션 > 앱 추가
3. 앱 설정 > 키 발급
   - **Admin Key** 발급 (송금 API 사용)
   - REST API Key도 함께 저장

4. 가맹점 코드(CID) 발급
   - 카카오페이 비즈니스 관리자 페이지에서 확인
   - 테스트용: `TC0ONETIME` (개발 환경)

### 3. 환경 변수 설정

`.env` 파일에 다음 내용 추가:

```env
# 카카오페이 송금 API 설정
KAKAOPAY_ADMIN_KEY=발급받은_Admin_Key
KAKAOPAY_CID=가맹점_코드

# 애플리케이션 URL (콜백용)
APP_URL=https://your-domain.com
```

**중요**: `.env` 파일은 절대 Git에 커밋하지 마세요!

### 4. Railway 환경 변수 설정

Railway 대시보드에서 환경 변수 추가:

```bash
# Railway CLI 사용 시
railway variables set KAKAOPAY_ADMIN_KEY="your_admin_key"
railway variables set KAKAOPAY_CID="your_cid"
railway variables set APP_URL="https://your-app.railway.app"
```

또는 Railway 웹 대시보드:
1. Project Settings
2. Variables 탭
3. New Variable 클릭
4. 위 변수들 추가

## 💳 사용 방법

### 관리자 (Manager/Admin)

1. **결제요청 페이지 접속**
   - 결제요청 목록에서 "대기중" 탭 선택

2. **즉시송금 버튼 클릭**
   - 카드 하단의 "즉시송금" 버튼 클릭
   - 카카오페이 결제 페이지가 새 창으로 열림

3. **송금 진행**
   - 카카오페이 앱으로 승인
   - 또는 카카오페이 웹에서 비밀번호 입력

4. **송금 완료**
   - 자동으로 결제 요청이 "완료" 상태로 변경
   - 수신자에게 알림 발송

### 일반 사용자

- 결제 요청만 가능
- 송금 버튼은 표시되지 않음

## 🔍 작동 원리

### 송금 프로세스

```
1. [즉시송금 버튼 클릭]
   ↓
2. [프론트엔드: 결제 정보 수집]
   - 수신자 이름
   - 계좌번호
   - 은행명
   - 송금 금액
   ↓
3. [백엔드 API 호출]
   POST /api/payments/kakaopay/transfer
   ↓
4. [카카오페이 API 호출]
   - 송금 준비 요청
   - TID (Transaction ID) 발급
   ↓
5. [사용자에게 결제 페이지 제공]
   - PC: next_redirect_pc_url
   - 모바일: next_redirect_mobile_url
   ↓
6. [사용자 승인]
   - 카카오페이 앱/웹에서 승인
   ↓
7. [콜백 처리]
   - 성공: /api/payments/kakaopay/success
   - 취소: /api/payments/kakaopay/cancel
   - 실패: /api/payments/kakaopay/fail
   ↓
8. [데이터베이스 업데이트]
   - 상태 변경: pending → completed
   - TID 저장
   - 승인 시간 기록
```

## 💰 비용 안내

### 카카오페이 송금 수수료

| 구분 | 수수료 | 설명 |
|------|--------|------|
| 기본 수수료 | 건당 300원 | 일반 송금 |
| 대량 할인 | 건당 250원 | 월 1,000건 이상 |
| 초대량 할인 | 건당 200원 | 월 10,000건 이상 |

### 예상 비용 계산

```
일일 평균 결제: 20건
월간 결제: 20 × 22일 = 440건
월 예상 비용: 440 × 300원 = 132,000원
```

## 🛠️ 문제 해결

### 자주 발생하는 오류

#### 1. "KAKAOPAY_ADMIN_KEY가 설정되지 않았습니다"
**원인**: 환경 변수 누락
**해결**:
```bash
# .env 파일 확인
cat .env | grep KAKAOPAY

# Railway 변수 확인
railway variables
```

#### 2. "송금 요청에 실패했습니다"
**원인**:
- API 키 오류
- 계좌 정보 누락
- 카카오페이 서비스 승인 미완료

**해결**:
1. Admin Key 재확인
2. 결제 요청에 계좌 정보 입력 확인
3. 카카오페이 비즈니스 계정 상태 확인

#### 3. "계좌 정보가 없습니다"
**원인**: 결제 요청 생성 시 계좌 정보 미입력
**해결**: 결제 요청 수정하여 다음 정보 입력
- 은행명
- 계좌번호
- 예금주

### 로그 확인

#### 서버 로그
```bash
# Railway 로그 확인
railway logs

# 특정 검색
railway logs | grep "kakaopay"
```

#### 브라우저 콘솔
```javascript
// 개발자 도구 (F12) > Console
// 카카오페이 관련 로그 확인
```

## 🧪 테스트 방법

### 개발 환경 테스트

1. **테스트용 CID 사용**
```env
KAKAOPAY_CID=TC0ONETIME
```

2. **테스트 결제 요청 생성**
   - 소액(1,000원)으로 테스트
   - 본인 계좌로 송금 테스트

3. **로그 확인**
```bash
# 서버 터미널에서
tail -f logs.txt | grep kakaopay
```

### 프로덕션 전환

1. 실제 CID로 변경
2. Admin Key를 프로덕션 키로 교체
3. APP_URL을 실제 도메인으로 변경

```env
KAKAOPAY_ADMIN_KEY=프로덕션_Admin_Key
KAKAOPAY_CID=실제_가맹점_코드
APP_URL=https://your-domain.com
```

## 📞 지원 및 문의

### 카카오페이 고객센터
- 전화: 1644-7405
- 운영시간: 평일 09:00~18:00
- 이메일: kakaopay_help@kakaocorp.com

### 개발 관련 문의
- 카카오 개발자 포럼: https://devtalk.kakao.com
- API 문서: https://developers.kakao.com/docs/latest/ko/kakaopay/common

## 🔐 보안 주의사항

1. **API 키 보관**
   - Admin Key는 절대 노출 금지
   - .env 파일을 .gitignore에 추가
   - 서버 환경 변수로만 관리

2. **HTTPS 사용**
   - 프로덕션 환경에서는 반드시 HTTPS 사용
   - HTTP에서는 카카오페이 결제 불가

3. **권한 관리**
   - 즉시송금 버튼은 Manager/Admin만 접근
   - 일반 사용자는 결제 요청만 가능

## ✅ 체크리스트

배포 전 확인사항:

- [ ] 카카오페이 비즈니스 계정 승인 완료
- [ ] Admin Key 발급 완료
- [ ] CID 발급 완료
- [ ] 환경 변수 설정 (.env)
- [ ] Railway 환경 변수 설정
- [ ] 데이터베이스 마이그레이션 실행
- [ ] 테스트 송금 성공
- [ ] HTTPS 설정 완료
- [ ] 오류 로깅 확인

## 📚 추가 참고 자료

- [카카오페이 개발 가이드](https://developers.kakao.com/docs/latest/ko/kakaopay/common)
- [카카오페이 비즈니스](https://kakaopay.com/business)
- [결제 API 레퍼런스](https://developers.kakao.com/docs/latest/ko/kakaopay/single-payment)
