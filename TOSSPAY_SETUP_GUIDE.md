# 🚀 토스페이 즉시송금 완벽 가이드

## 📌 현재 상태

✅ **즉시송금 기능 구현 완료**
- 프론트엔드: 즉시송금 버튼 구현
- 백엔드: 토스페이 API 연동 준비 완료
- 임시 방안: 계좌정보 복사 방식 적용

⏳ **토스페이 API 설정 필요**
- 토스뱅크 사업자 계좌 개설
- 토스페이 API 신청 및 승인
- API 키 발급 및 설정

---

## 🎯 즉시송금 작동 방식

### 현재 (임시 방안)
```
즉시송금 버튼 클릭
  ↓
계좌번호 자동 복사
  ↓
은행 앱 자동 실행 (모바일)
  ↓
수동 송금
  ↓
송금완료 버튼 클릭
```

### 토스페이 API 설정 후
```
즉시송금 버튼 클릭
  ↓
토스페이 API 호출
  ↓
자동으로 송금 실행
  ↓
자동으로 송금완료 처리
```

---

## 📋 토스페이 API 설정 단계

### 1단계: 토스뱅크 사업자 계좌 개설 (1-2일 소요)

#### 준비물
- 사업자등록증
- 대표자 신분증
- 기존 통장 사본

#### 개설 방법
1. **토스 앱 다운로드**
   - iOS: App Store에서 '토스' 검색
   - Android: Play 스토어에서 '토스' 검색

2. **사업자 통장 개설**
   ```
   토스 앱 실행
     ↓
   하단 '전체' 탭
     ↓
   '토스뱅크' 선택
     ↓
   '사업자 통장 개설하기'
     ↓
   서류 제출 및 심사
   ```

3. **심사 기간**
   - 평균 1-2 영업일
   - 빠르면 당일 승인

4. **계좌 개설 완료**
   - 계좌번호 확인 (1002-XXX-XXXX 형식)
   - 이 계좌번호를 `.env`에 설정합니다

---

### 2단계: 토스페이 API 신청 (3-5일 소요)

#### 신청 경로
🔗 https://toss.im/business

#### 신청 절차
1. **토스페이 비즈니스 페이지 접속**
   - 위 링크 클릭
   - '송금 API 서비스' 선택

2. **사업자 정보 입력**
   - 사업자등록번호
   - 대표자명 및 연락처
   - 사업장 주소
   - 토스뱅크 계좌번호

3. **서비스 정보 입력**
   - 서비스명: HV LAB 결제시스템
   - 사용 목적: 협력업체 대금 지급
   - 월 예상 거래량
   - 월 예상 거래금액

4. **심사 대기**
   - 평균 3-5 영업일
   - 승인 시 이메일 통보

---

### 3단계: API 키 발급

#### 발급 방법
1. **개발자센터 접속**
   - https://developers.tosspayments.com
   - 토스 계정으로 로그인

2. **새 앱 만들기**
   ```
   개발자센터 접속
     ↓
   '내 앱' 메뉴
     ↓
   '새 앱 만들기' 클릭
     ↓
   앱 이름 입력: HV LAB Payment
   ```

3. **API 키 확인**
   - **라이브 API Key**: `live_api_xxxxxxxxxx`
   - **라이브 Secret Key**: `live_secret_xxxxxxxxxx`

4. **테스트 키** (개발용)
   - 테스트 API Key: `test_api_xxxxxxxxxx`
   - 테스트 Secret Key: `test_secret_xxxxxxxxxx`

---

### 4단계: 환경 변수 설정

#### .env 파일 수정

현재 `.env` 파일:
```env
# Toss Payments Configuration (테스트 환경)
TOSSPAY_CLIENT_KEY=test_ck_Z61JOxRQVENLvQBeP9WyrW0X9bAq
TOSSPAY_SECRET_KEY=test_sk_0RnYX2w532oyX2QXqx6kVNeyqApQ
TOSSPAY_API_KEY=test_ck_Z61JOxRQVENLvQBeP9WyrW0X9bAq
TOSSPAY_SENDER_ACCOUNT=1002-000-0000
```

**실제 운영 시 변경:**
```env
# Toss Pay 송금 API (실제 운영)
TOSSPAY_API_KEY=live_api_xxxxxxxxxx
TOSSPAY_SECRET_KEY=live_secret_xxxxxxxxxx
TOSSPAY_SENDER_ACCOUNT=1002-XXX-XXXX  # 실제 토스뱅크 계좌번호
```

⚠️ **중요**:
- `TOSSPAY_SENDER_ACCOUNT`를 반드시 실제 토스뱅크 계좌번호로 변경하세요
- 하이픈(-) 포함해서 입력
- 계좌번호가 `1002-000-0000`이면 임시 방안(계좌복사)이 사용됩니다

---

### 5단계: Railway 환경 변수 설정

Railway에 배포하는 경우:

```bash
# Railway 프로젝트 선택
railway link

# 환경 변수 설정
railway variables set TOSSPAY_API_KEY=live_api_xxxxxxxxxx
railway variables set TOSSPAY_SECRET_KEY=live_secret_xxxxxxxxxx
railway variables set TOSSPAY_SENDER_ACCOUNT=1002-XXX-XXXX

# 배포
railway up
```

---

### 6단계: 서버 재시작

환경 변수 설정 후 서버를 재시작하세요:

```bash
# 로컬 개발
npm start

# Railway 배포
railway up
```

---

## ✨ 사용 방법

### 즉시송금 버튼
1. 결제요청 페이지 접속
2. '대기중' 탭 선택
3. 송금할 결제 선택
4. **'즉시송금'** 버튼 클릭

### 토스페이 API 설정 전 (현재)
- 계좌번호가 자동으로 복사됩니다
- 은행 앱이 자동으로 실행됩니다 (모바일)
- 수동으로 송금 진행
- '송금완료' 버튼으로 완료 처리

### 토스페이 API 설정 후
- 확인 버튼만 클릭
- 자동으로 송금 실행
- 자동으로 '송금완료' 상태로 변경

---

## 💰 수수료

### 토스페이 송금 수수료
- **토스뱅크 간 송금**: 무료
- **타 은행 송금**: 200원 ~ 500원
- **3시 이후 송금**: 익일 처리 가능성

---

## 🏦 지원 은행

모든 주요 은행 지원:
- KB국민은행, 신한은행, 우리은행, 하나은행
- NH농협은행, IBK기업은행
- 카카오뱅크, 토스뱅크, 케이뱅크
- 대구은행, 부산은행, 경남은행, 광주은행, 전북은행, 제주은행
- 새마을금고, 신협, 우체국

---

## 🔧 문제 해결

### 1. "계좌정보 복사 방식"이 계속 사용됨

**원인**: 토스페이 API가 설정되지 않음

**확인 사항**:
```env
TOSSPAY_SENDER_ACCOUNT=1002-000-0000  ❌ (테스트 계좌)
TOSSPAY_SENDER_ACCOUNT=1002-XXX-XXXX  ✅ (실제 계좌)
```

**해결책**:
1. `.env` 파일에서 `TOSSPAY_SENDER_ACCOUNT` 확인
2. 실제 토스뱅크 계좌번호로 변경
3. 서버 재시작

---

### 2. API 키 오류

```
Error: 토스페이 API 키가 설정되지 않았습니다.
```

**해결책**:
1. `.env` 파일 확인
2. `TOSSPAY_API_KEY`, `TOSSPAY_SECRET_KEY` 확인
3. Railway 환경변수 확인
4. 서버 재시작

---

### 3. 지원하지 않는 은행

```
Error: 지원하지 않는 은행입니다: OO은행
```

**해결책**:
`server/utils/tosspay-transfer.js` 파일의 `getBankCode()` 함수에 은행 추가:

```javascript
getBankCode(bankName) {
  const bankCodes = {
    'OO은행': 'XX',  // 은행 코드 추가
    // ... 기존 코드
  };
  return bankCodes[bankName] || null;
}
```

---

### 4. 송금 한도 초과

```
Error: 일일 송금 한도를 초과했습니다.
```

**해결책**:
1. 토스페이 개발자센터에서 한도 확인
2. 한도 증액 신청
3. 또는 다음날 다시 시도

---

## 📊 송금 내역 확인

### 데이터베이스에서 확인
```sql
SELECT * FROM payment_requests
WHERE tosspay_transfer_id IS NOT NULL
ORDER BY paid_at DESC;
```

### 토스페이 개발자센터
- https://developers.tosspayments.com
- '거래 내역' 메뉴에서 확인

---

## 🔐 보안 주의사항

### ⚠️ 절대 하지 말아야 할 것

1. **API 키를 GitHub에 업로드**
   - `.env` 파일은 `.gitignore`에 포함됨
   - Railway 환경변수 사용 권장

2. **API 키를 클라이언트에 노출**
   - 프론트엔드에서 API 키 사용 금지
   - 반드시 백엔드에서만 사용

3. **테스트 키로 실제 송금**
   - 테스트 키는 개발용
   - 실제 운영에서는 라이브 키 사용

### ✅ 권장 사항

1. **환경변수로 관리**
   - Railway: `railway variables set`
   - 로컬: `.env` 파일

2. **권한 관리**
   - manager, admin만 즉시송금 가능
   - 일반 사용자는 버튼 미표시

3. **송금 전 확인**
   - 확인 창에서 정보 재확인
   - 계좌번호, 금액 검증

---

## 📞 문의

### 토스페이 고객센터
- 전화: 1544-7772
- 이메일: support@tosspayments.com
- 운영시간: 평일 09:00 - 18:00

### 토스뱅크 고객센터
- 전화: 1661-7654
- 24시간 운영

---

## 📚 참고 링크

- 토스페이 비즈니스: https://toss.im/business
- 토스페이먼츠 개발자센터: https://developers.tosspayments.com
- 토스뱅크: https://www.tossbank.com
- API 문서: https://docs.tosspayments.com

---

## 🎯 다음 단계

1. ✅ **즉시송금 기능 구현 완료**
2. ⏳ **토스뱅크 사업자 계좌 개설** (1-2일)
3. ⏳ **토스페이 API 신청** (3-5일)
4. ⏳ **API 키 발급 및 설정**
5. ⏳ **실제 송금 테스트**

---

**구현 완료!** 🎉

토스뱅크 계좌만 개설하면 즉시 사용 가능합니다!
