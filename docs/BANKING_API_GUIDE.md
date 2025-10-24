# 은행 API 송금 기능 구현 가이드

## 1. 오픈뱅킹 API 사용 (권장)

### 신청 절차
1. 오픈뱅킹 포털 접속 (https://www.openbanking.or.kr)
2. 이용기관 등록 신청
3. 테스트베드 이용 신청
4. 심사 및 승인 (약 2-4주)
5. 본인증 서비스 연동
6. 상용 서비스 전환

### 비용
- 기본 이용료: 월 5만원 ~
- 거래 수수료: 건당 20원 ~ 50원
- 초기 구축비: 별도 협의

### 주요 API 기능
- 사용자 인증 (OAuth 2.0)
- 계좌 조회
- 잔액 조회
- 거래내역 조회
- **송금 (출금이체)**
- 입금 확인

---

## 2. 구현 예시 코드

### Backend - 오픈뱅킹 API 연동

```javascript
// server/services/openBankingService.js
const axios = require('axios');

class OpenBankingService {
  constructor() {
    this.baseURL = process.env.OPENBANKING_API_URL || 'https://testapi.openbanking.or.kr';
    this.clientId = process.env.OPENBANKING_CLIENT_ID;
    this.clientSecret = process.env.OPENBANKING_CLIENT_SECRET;
  }

  // 1. 사용자 인증 토큰 발급
  async getAccessToken(authCode) {
    try {
      const response = await axios.post(`${this.baseURL}/oauth/2.0/token`, {
        code: authCode,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: process.env.OPENBANKING_REDIRECT_URI,
        grant_type: 'authorization_code'
      });

      return response.data;
    } catch (error) {
      console.error('Token error:', error);
      throw error;
    }
  }

  // 2. 출금이체 (송금)
  async transfer(data) {
    const {
      accessToken,
      bankCode,           // 입금은행코드
      accountNumber,      // 입금계좌번호
      accountHolder,      // 입금계좌 예금주명
      amount,            // 송금액
      withdrawAccountNo, // 출금계좌번호
      withdrawBankCode,  // 출금은행코드
      purpose           // 송금 용도
    } = data;

    try {
      // 거래 고유번호 생성 (YYYYMMDD + 일련번호 9자리)
      const transactionId = this.generateTransactionId();

      const response = await axios.post(
        `${this.baseURL}/v2.0/transfer/withdraw/fin_num`,
        {
          bank_tran_id: transactionId,           // 거래고유번호
          cntr_account_type: 'N',                // 약정 계좌/계정 구분
          cntr_account_num: withdrawAccountNo,   // 출금계좌번호
          dps_print_content: purpose,            // 입금계좌인자내역
          fintech_use_num: withdrawAccountNo,    // 핀테크이용번호
          wd_print_content: purpose,             // 출금계좌인자내역
          tran_amt: amount,                      // 거래금액
          tran_dtime: this.getCurrentDateTime(), // 거래일시
          req_client_name: accountHolder,        // 요청고객성명
          req_client_fintech_use_num: withdrawAccountNo,
          req_client_num: transactionId.substr(0, 12),
          transfer_purpose: 'ST',                // 이체용도 (ST: 학자금)
          recv_client_name: accountHolder,       // 최종수취고객성명
          recv_client_bank_code: bankCode,       // 최종수취고객 계좌 개설기관 표준코드
          recv_client_account_num: accountNumber // 최종수취고객 계좌번호
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Transfer error:', error.response?.data || error);
      throw error;
    }
  }

  // 3. 거래 결과 조회
  async getTransferResult(transactionId, accessToken) {
    try {
      const response = await axios.get(
        `${this.baseURL}/v2.0/transfer/result`,
        {
          params: {
            bank_tran_id: transactionId
          },
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Get result error:', error);
      throw error;
    }
  }

  // 거래고유번호 생성
  generateTransactionId() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString().slice(2, 11);
    return `${dateStr}${randomStr}`;
  }

  // 현재 시각 (YYYYMMDDHHmmss)
  getCurrentDateTime() {
    const now = new Date();
    return now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  }
}

module.exports = new OpenBankingService();
```

### Backend - API 라우트

```javascript
// server/routes/banking.js
const express = require('express');
const router = express.Router();
const openBankingService = require('../services/openBankingService');
const { authenticateToken, isManager } = require('../middleware/auth');

// 오픈뱅킹 인증 페이지로 리다이렉트
router.get('/auth/redirect', authenticateToken, (req, res) => {
  const authUrl = `https://testapi.openbanking.or.kr/oauth/2.0/authorize?` +
    `response_type=code&` +
    `client_id=${process.env.OPENBANKING_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(process.env.OPENBANKING_REDIRECT_URI)}&` +
    `scope=inquiry transfer&` +
    `state=${req.user.id}`;

  res.redirect(authUrl);
});

// 오픈뱅킹 콜백 처리
router.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  try {
    const tokenData = await openBankingService.getAccessToken(code);

    // 토큰을 데이터베이스에 저장 (사용자별)
    // TODO: 토큰 저장 로직 구현

    res.redirect('/payments?auth=success');
  } catch (error) {
    console.error('Auth callback error:', error);
    res.redirect('/payments?auth=failed');
  }
});

// 송금 실행
router.post('/transfer', authenticateToken, isManager, async (req, res) => {
  const {
    paymentId,
    bankCode,
    accountNumber,
    accountHolder,
    amount
  } = req.body;

  try {
    // TODO: 사용자의 오픈뱅킹 토큰 조회
    const userToken = 'USER_ACCESS_TOKEN'; // DB에서 조회

    // 송금 실행
    const result = await openBankingService.transfer({
      accessToken: userToken,
      bankCode,
      accountNumber,
      accountHolder,
      amount,
      withdrawAccountNo: process.env.COMPANY_ACCOUNT_NO,
      withdrawBankCode: process.env.COMPANY_BANK_CODE,
      purpose: `결제요청 #${paymentId}`
    });

    // 송금 성공 시 결제 요청 상태 업데이트
    if (result.rsp_code === 'A0000') {
      // TODO: 결제 요청을 'completed'로 업데이트

      res.json({
        success: true,
        message: '송금이 완료되었습니다',
        transactionId: result.bank_tran_id
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.rsp_message
      });
    }
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({
      success: false,
      message: '송금 처리 중 오류가 발생했습니다'
    });
  }
});

module.exports = router;
```

### Frontend - 송금 버튼 (오픈뱅킹 연동)

```typescript
// src/pages/Payments.tsx 수정안
{payment.status === 'pending' && (
  <>
    <button
      onClick={async () => {
        if (!payment.bankInfo?.accountNumber) {
          toast.error('계좌 정보가 없습니다');
          return;
        }

        if (!window.confirm(
          `${payment.bankInfo.accountHolder}님에게\n` +
          `${payment.amount.toLocaleString()}원을 송금하시겠습니까?\n\n` +
          `은행: ${payment.bankInfo.bankName}\n` +
          `계좌: ${payment.bankInfo.accountNumber}`
        )) {
          return;
        }

        try {
          const response = await fetch('/api/banking/transfer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              paymentId: payment.id,
              bankCode: getBankCode(payment.bankInfo.bankName),
              accountNumber: payment.bankInfo.accountNumber,
              accountHolder: payment.bankInfo.accountHolder,
              amount: payment.amount
            })
          });

          const result = await response.json();

          if (result.success) {
            toast.success('송금이 완료되었습니다');
            await loadPaymentsFromAPI(); // 목록 새로고침
          } else {
            toast.error(result.message);
          }
        } catch (error) {
          console.error('Transfer error:', error);
          toast.error('송금 처리 중 오류가 발생했습니다');
        }
      }}
      className="flex-1 lg:flex-none text-xs md:text-sm px-3 md:px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium whitespace-nowrap flex items-center justify-center gap-1"
    >
      <Smartphone className="w-3 h-3 md:w-3.5 md:h-3.5" />
      즉시송금
    </button>
  </>
)}
```

---

## 3. 환경 변수 설정

```env
# .env
# 오픈뱅킹 API 설정
OPENBANKING_API_URL=https://testapi.openbanking.or.kr
OPENBANKING_CLIENT_ID=your_client_id
OPENBANKING_CLIENT_SECRET=your_client_secret
OPENBANKING_REDIRECT_URI=https://hvlab.app/api/banking/auth/callback

# 회사 계좌 정보
COMPANY_BANK_CODE=004
COMPANY_ACCOUNT_NO=123456789012
COMPANY_FINTECH_USE_NUM=your_fintech_use_number
```

---

## 4. 은행 코드 매핑

```javascript
// src/utils/bankCodes.ts
export const BANK_CODES: Record<string, string> = {
  'KB국민은행': '004',
  '신한은행': '088',
  '우리은행': '020',
  'NH농협은행': '011',
  '하나은행': '081',
  '기업은행': '003',
  'SC제일은행': '023',
  '한국씨티은행': '027',
  '경남은행': '039',
  '광주은행': '034',
  '대구은행': '031',
  '부산은행': '032',
  '전북은행': '037',
  '제주은행': '035',
  '케이뱅크': '089',
  '카카오뱅크': '090',
  '토스뱅크': '092'
};

export function getBankCode(bankName: string): string {
  return BANK_CODES[bankName] || '';
}
```

---

## 5. 보안 고려사항

### 필수 보안 조치
1. **토큰 관리**
   - Access Token은 암호화하여 DB 저장
   - Refresh Token을 통한 자동 갱신
   - 토큰 만료 시간 관리

2. **거래 검증**
   - 2차 인증 (OTP, 생체인증 등)
   - IP 화이트리스트
   - 거래 한도 설정

3. **로그 및 감사**
   - 모든 송금 시도 기록
   - 실패 사유 저장
   - 주기적 보안 감사

4. **데이터 암호화**
   - 계좌번호 암호화 저장
   - SSL/TLS 통신
   - 민감정보 마스킹

---

## 6. 예상 비용 (월간)

### 초기 비용
- 오픈뱅킹 가입비: 무료
- 테스트베드 이용: 무료
- 개발 비용: 500만원 ~ 2000만원

### 운영 비용 (월)
- 기본 이용료: 5만원
- 거래 수수료: 20원 × 거래건수
  - 예: 월 100건 = 2,000원
  - 예: 월 1000건 = 20,000원
- 보안 인증서: 월 5만원
- 서버 증설: 필요시

### 예시 계산
- 월 300건 송금 시
  - 기본료: 50,000원
  - 거래수수료: 20원 × 300 = 6,000원
  - 인증서: 50,000원
  - **총: 약 106,000원**

---

## 7. 구현 단계 (추천)

### Phase 1 (2-3주)
1. 오픈뱅킹 포털 가입 및 심사
2. 테스트베드 환경 구축
3. 인증 플로우 구현

### Phase 2 (2주)
1. 송금 API 연동
2. 보안 설정 및 암호화
3. 에러 처리 및 롤백

### Phase 3 (1주)
1. 테스트 및 디버깅
2. 로그 시스템 구축
3. 상용 전환 신청

### Phase 4 (1주)
1. 상용 서비스 전환
2. 모니터링 설정
3. 사용자 교육

---

## 8. 대안 방안

### A. 간편송금 링크
- 토스, 카카오페이 등의 송금 링크 생성
- API 없이도 구현 가능
- 수수료 낮음

### B. 계좌이체 QR코드
- QR코드로 계좌정보 전달
- 사용자가 직접 뱅킹앱에서 스캔

### C. 현재 방식 개선
- 계좌정보 복사 후 딥링크
- 토스/카카오페이 송금하기 버튼

---

## 결론

**즉시 구현 추천:**
현재는 계좌정보 복사 방식을 유지하고,
향후 거래량이 증가하면 오픈뱅킹 API 도입을 검토하는 것을 추천합니다.

**오픈뱅킹 API 도입 시점:**
- 월 거래건수 500건 이상
- 송금 프로세스 자동화 필요
- 관리자 업무 부담 감소 필요
