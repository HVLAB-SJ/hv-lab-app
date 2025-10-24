# KB국민은행 무료 API 연동 가이드

## 개요
오픈뱅킹 대신 KB국민은행 직접 API를 사용하면 **월 비용 없이** 송금 기능을 구현할 수 있습니다.

## KB국민은행 API 옵션

### 1. KB스타뱅킹 기업 API (추천)
**장점:**
- ✅ **무료** (기업 거래 고객이면 추가 비용 없음)
- ✅ 실시간 송금
- ✅ 조회 기능 제공

**단점:**
- ❌ KB 계좌만 사용 가능 (출금 계좌가 KB여야 함)
- ❌ 받는 계좌는 모든 은행 가능

**신청 방법:**
1. 가까운 KB국민은행 영업점 방문
2. 기업 인터넷뱅킹 가입
3. 기업 API 서비스 신청
4. API Key 및 인증서 발급 (무료)

**비용:**
- 가입비: 무료
- 월 이용료: 무료
- 거래 수수료: 일반 이체 수수료만 (타행 500원, 동행 무료)

---

### 2. 카카오페이 송금하기 API (가장 간단)
**장점:**
- ✅ **완전 무료**
- ✅ 구현 매우 간단
- ✅ 모든 은행 지원
- ✅ 별도 인증 불필요

**단점:**
- ❌ 수동 확인 필요 (자동 송금 아님)
- ❌ 사용자가 카카오페이 앱 필요

**동작 방식:**
1. 송금 버튼 클릭
2. 카카오페이 송금 링크 생성
3. 사용자가 카카오페이에서 송금
4. 관리자가 수동으로 '송금완료' 처리

**구현 예시:**
```typescript
// 카카오페이 송금 링크 생성
const kakaoPayUrl = `https://qr.kakaopay.com/Ej8KPEw37`;
// 또는 계좌정보 포함
const message = `카카오페이로 송금해주세요\n${accountNumber}\n${amount}원`;
```

---

### 3. 토스페이먼츠 계좌이체 (추천 #2)
**장점:**
- ✅ 초기 무료 (거래량 적으면 무료)
- ✅ 모든 은행 지원
- ✅ 자동화 가능
- ✅ 간편 연동

**단점:**
- ❌ 월 거래 100건 이상부터 수수료 (건당 150원)

**비용:**
- 가입비: 무료
- 월 100건까지: **무료**
- 101건부터: 건당 150원

**신청:**
https://www.tosspayments.com

---

## 비교표

| 방식 | 월 비용 | 거래 수수료 | 자동화 | 지원 은행 |
|------|---------|-------------|--------|-----------|
| 오픈뱅킹 | 50,000원 | 20원 | ⭕ | 전체 |
| KB기업API | 0원 | 500원(타행) | ⭕ | 전체(수취) |
| 카카오페이 | 0원 | 0원 | ❌ | 전체 |
| 토스페이먼츠 | 0원* | 0-150원 | ⭕ | 전체 |

*월 100건까지 무료

---

## 추천 방안

### 현재 상황에 맞는 최적 솔루션

**Option 1: KB기업API (추천)**
- 회사 주거래 은행이 KB국민은행인 경우
- 월 거래 건수가 많은 경우
- 완전 자동화 필요

**Option 2: 토스페이먼츠**
- 월 거래 100건 이하
- 모든 은행 계좌에서 출금 필요
- 빠른 구현 필요

**Option 3: 카카오페이 링크**
- 당장 무료로 시작하고 싶은 경우
- 수동 처리 가능한 경우
- 가장 간단한 구현

---

## KB기업 API 구현 예시

### 1. 신청 및 설정
```bash
# KB국민은행 영업점 방문
1. 기업 인터넷뱅킹 신청
2. API 서비스 신청서 작성
3. 공인인증서 발급
4. API Key 발급 (3-5일 소요)
```

### 2. 환경 변수
```env
# KB기업 API
KB_API_URL=https://openapi.kbstar.com
KB_API_KEY=발급받은_API_Key
KB_CERT_PATH=/path/to/certificate.pfx
KB_CERT_PASSWORD=인증서_비밀번호
KB_ACCOUNT_NUMBER=출금계좌번호
```

### 3. KB API 서비스 코드
```javascript
// server/services/kbBankService.js
const axios = require('axios');
const fs = require('fs');

class KBBankService {
  constructor() {
    this.apiUrl = process.env.KB_API_URL;
    this.apiKey = process.env.KB_API_KEY;
  }

  // 계좌이체
  async transfer(data) {
    const {
      toBankCode,
      toAccountNumber,
      toAccountHolder,
      amount,
      memo
    } = data;

    try {
      const response = await axios.post(
        `${this.apiUrl}/v1/transfer`,
        {
          from_account: process.env.KB_ACCOUNT_NUMBER,
          to_bank_code: toBankCode,
          to_account: toAccountNumber,
          to_name: toAccountHolder,
          amount: amount,
          memo: memo
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.result_code === '0000') {
        return {
          success: true,
          transactionId: response.data.transaction_id,
          amount: amount
        };
      } else {
        return {
          success: false,
          error: response.data.result_message
        };
      }
    } catch (error) {
      console.error('KB transfer error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 잔액 조회
  async getBalance() {
    try {
      const response = await axios.get(
        `${this.apiUrl}/v1/account/balance`,
        {
          params: {
            account_number: process.env.KB_ACCOUNT_NUMBER
          },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return {
        success: true,
        balance: response.data.balance
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new KBBankService();
```

---

## 토스페이먼츠 구현 예시

### 1. 가입
https://www.tosspayments.com 에서 무료 가입

### 2. 환경 변수
```env
TOSS_CLIENT_KEY=발급받은_클라이언트_키
TOSS_SECRET_KEY=발급받은_시크릿_키
```

### 3. 토스 서비스 코드
```javascript
// server/services/tossPaymentService.js
const axios = require('axios');

class TossPaymentService {
  constructor() {
    this.baseURL = 'https://api.tosspayments.com';
    this.secretKey = process.env.TOSS_SECRET_KEY;
  }

  async requestTransfer(data) {
    const {
      bankCode,
      accountNumber,
      accountHolder,
      amount,
      orderName
    } = data;

    try {
      const response = await axios.post(
        `${this.baseURL}/v1/transfers`,
        {
          bank_code: bankCode,
          account_number: accountNumber,
          holder_name: accountHolder,
          amount: amount,
          description: orderName
        },
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
}

module.exports = new TossPaymentService();
```

---

## 카카오페이 링크 방식 (가장 간단)

### 구현
```typescript
// src/pages/Payments.tsx
<button
  onClick={() => {
    const { bankName, accountNumber, accountHolder } = payment.bankInfo;

    // 카카오톡으로 송금 정보 공유
    const message =
      `💰 송금 요청\n\n` +
      `받는분: ${accountHolder}\n` +
      `은행: ${bankName}\n` +
      `계좌: ${accountNumber}\n` +
      `금액: ${payment.amount.toLocaleString()}원\n\n` +
      `카카오페이 또는 뱅킹앱으로 송금해주세요.`;

    // 클립보드에 복사
    navigator.clipboard.writeText(message);

    // 카카오톡 공유 (선택사항)
    if (window.Kakao) {
      window.Kakao.Link.sendDefault({
        objectType: 'text',
        text: message,
        link: {
          mobileWebUrl: window.location.href,
          webUrl: window.location.href
        }
      });
    }

    toast.success('송금 정보가 복사되었습니다');
  }}
>
  간편송금
</button>
```

---

## 월 비용 비교 (100건 기준)

| 방식 | 초기비용 | 월정액 | 거래수수료 | 총비용 |
|------|---------|--------|-----------|--------|
| 오픈뱅킹 | 0원 | 50,000원 | 2,000원 | **52,000원** |
| KB기업API | 0원 | 0원 | 50,000원* | **50,000원** |
| 토스페이먼츠 | 0원 | 0원 | 0원 | **0원** |
| 카카오페이 | 0원 | 0원 | 0원 | **0원** |

*타행 이체 500원 × 100건 = 50,000원 (동행은 무료)

---

## 결론 및 추천

### 📌 즉시 적용 가능 (무료)
1. **카카오페이/토스 링크 방식**으로 시작
2. 거래량 증가하면 **토스페이먼츠** 도입
3. 완전 자동화 필요하면 **KB기업 API** 신청

### 💡 단계별 전략
```
1단계 (지금): 카카오페이 링크 (무료, 수동)
    ↓ 거래 증가
2단계: 토스페이먼츠 (월 100건까지 무료, 자동)
    ↓ 더 많은 거래
3단계: KB기업 API 또는 오픈뱅킹 (완전 자동화)
```

어떤 방식으로 진행하시겠습니까?
