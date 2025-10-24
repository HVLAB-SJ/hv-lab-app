const axios = require('axios');
const crypto = require('crypto');

/**
 * KB국민은행 기업 API 서비스
 * 무료로 사용 가능한 KB 기업뱅킹 API
 */
class KBBankService {
  constructor() {
    // KB API 엔드포인트
    this.apiUrl = process.env.KB_API_URL || 'https://api.kbstar.com';

    // API 인증 정보
    this.clientId = process.env.KB_CLIENT_ID;
    this.clientSecret = process.env.KB_CLIENT_SECRET;

    // 회사 계좌 정보
    this.companyAccount = process.env.KB_COMPANY_ACCOUNT;
    this.companyAccountHolder = process.env.KB_COMPANY_ACCOUNT_HOLDER || '회사명';

    // 인증서 정보
    this.certPath = process.env.KB_CERT_PATH;
    this.certPassword = process.env.KB_CERT_PASSWORD;
  }

  /**
   * Access Token 발급
   */
  async getAccessToken() {
    try {
      const timestamp = Date.now();
      const nonce = crypto.randomBytes(16).toString('hex');

      // KB API 인증
      const response = await axios.post(
        `${this.apiUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'transfer inquiry'
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        success: true,
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('[KB Bank] Get token error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * 계좌 잔액 조회
   */
  async getBalance(accessToken) {
    try {
      const transactionId = this.generateTransactionId();

      const response = await axios.post(
        `${this.apiUrl}/v1/account/balance`,
        {
          account_number: this.companyAccount,
          tran_dtime: this.getCurrentDateTime()
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Transaction-Id': transactionId
          }
        }
      );

      if (response.data.resp_code === '0000') {
        return {
          success: true,
          balance: parseInt(response.data.balance_amt),
          accountNumber: this.companyAccount
        };
      } else {
        return {
          success: false,
          error: response.data.resp_msg || '잔액 조회 실패'
        };
      }
    } catch (error) {
      console.error('[KB Bank] Balance error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.resp_msg || '잔액 조회 중 오류 발생'
      };
    }
  }

  /**
   * 계좌 이체 (송금)
   */
  async transfer(params) {
    const {
      accessToken,
      toBankCode,
      toAccountNumber,
      toAccountHolder,
      amount,
      memo
    } = params;

    try {
      const transactionId = this.generateTransactionId();
      const tranDtime = this.getCurrentDateTime();

      // KB API 송금 요청
      const requestData = {
        cntr_account_num: this.companyAccount,      // 출금계좌번호
        cntr_account_holder_name: this.companyAccountHolder, // 출금계좌 예금주
        wd_pass_phrase: memo || '결제대금',          // 출금계좌 인자내역
        recv_bank_code_std: toBankCode,             // 입금은행코드
        recv_account_num: toAccountNumber,          // 입금계좌번호
        recv_client_name: toAccountHolder,          // 입금계좌 예금주
        recv_client_bank_code: toBankCode,          // 최종 수취 은행
        tran_amt: String(amount),                   // 이체금액
        req_client_name: this.companyAccountHolder, // 요청자명
        req_client_num: transactionId.substring(0, 12), // 요청고객번호
        transfer_purpose: 'IR',                     // 이체목적 (IR: 상품구매대금)
        cms_num: '',                                // CMS번호 (없으면 공백)
        tran_dtime: tranDtime                       // 거래일시
      };

      console.log('[KB Bank] Transfer request:', {
        transactionId,
        to: `${toBankCode}-${toAccountNumber}`,
        amount,
        memo
      });

      const response = await axios.post(
        `${this.apiUrl}/v1/transfer/withdraw`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Transaction-Id': transactionId
          }
        }
      );

      console.log('[KB Bank] Transfer response:', response.data);

      // 응답 코드 확인
      if (response.data.resp_code === '0000') {
        return {
          success: true,
          data: {
            transactionId: transactionId,
            kbTransactionId: response.data.tran_no,
            amount: amount,
            timestamp: tranDtime,
            message: '송금이 완료되었습니다',
            fee: this.calculateFee(toBankCode, amount)
          }
        };
      } else {
        return {
          success: false,
          error: {
            code: response.data.resp_code,
            message: this.getErrorMessage(response.data.resp_code, response.data.resp_msg)
          }
        };
      }
    } catch (error) {
      console.error('[KB Bank] Transfer error:', error.response?.data || error);

      const errorCode = error.response?.data?.resp_code;
      const errorMsg = error.response?.data?.resp_msg;

      return {
        success: false,
        error: {
          code: errorCode || 'TRANSFER_ERROR',
          message: this.getErrorMessage(errorCode, errorMsg) || '송금 처리 중 오류가 발생했습니다'
        }
      };
    }
  }

  /**
   * 거래내역 조회
   */
  async getTransactionHistory(accessToken, fromDate, toDate) {
    try {
      const transactionId = this.generateTransactionId();

      const response = await axios.post(
        `${this.apiUrl}/v1/account/transaction-list`,
        {
          account_number: this.companyAccount,
          inquiry_type: 'A',  // A: 전체, I: 입금, O: 출금
          from_date: fromDate, // YYYYMMDD
          to_date: toDate,     // YYYYMMDD
          sort_order: 'D',     // D: 내림차순
          tran_dtime: this.getCurrentDateTime()
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Transaction-Id': transactionId
          }
        }
      );

      if (response.data.resp_code === '0000') {
        return {
          success: true,
          data: response.data.res_list || []
        };
      } else {
        return {
          success: false,
          error: response.data.resp_msg || '거래내역 조회 실패'
        };
      }
    } catch (error) {
      console.error('[KB Bank] Transaction history error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.resp_msg || '거래내역 조회 중 오류 발생'
      };
    }
  }

  /**
   * 수수료 계산
   * KB -> KB: 무료
   * KB -> 타행: 500원
   */
  calculateFee(toBankCode, amount) {
    // KB국민은행 코드: 004
    if (toBankCode === '004') {
      return 0; // KB끼리는 무료!
    } else {
      return 500; // 타행은 500원
    }
  }

  /**
   * 거래 고유번호 생성 (기관코드 + YYYYMMDD + 일련번호)
   */
  generateTransactionId() {
    const institutionCode = 'HVLAB'; // 임의 코드 (실제로는 KB에서 발급)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequenceNum = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');

    return `${institutionCode}${dateStr}${sequenceNum}`;
  }

  /**
   * 현재 날짜시간 (YYYYMMDDHHmmss)
   */
  getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * 에러 메시지 변환
   */
  getErrorMessage(code, defaultMsg) {
    const errorMessages = {
      '1001': '잔액이 부족합니다',
      '1002': '계좌번호가 올바르지 않습니다',
      '1003': '예금주명이 일치하지 않습니다',
      '1004': '일일 이체 한도를 초과했습니다',
      '1005': '1회 이체 한도를 초과했습니다',
      '2001': '인증 정보가 올바르지 않습니다',
      '2002': '접근 권한이 없습니다',
      '9999': '시스템 오류가 발생했습니다'
    };

    return errorMessages[code] || defaultMsg || '알 수 없는 오류가 발생했습니다';
  }

  /**
   * 서비스 상태 확인
   */
  async checkStatus() {
    try {
      const tokenResult = await this.getAccessToken();

      if (!tokenResult.success) {
        return {
          connected: false,
          message: 'KB API 인증 실패',
          error: tokenResult.error
        };
      }

      const balanceResult = await this.getBalance(tokenResult.accessToken);

      return {
        connected: balanceResult.success,
        message: balanceResult.success ? 'KB API 정상 연결' : 'KB API 연결 실패',
        balance: balanceResult.balance,
        account: this.companyAccount
      };
    } catch (error) {
      return {
        connected: false,
        message: 'KB API 연결 오류',
        error: error.message
      };
    }
  }
}

module.exports = new KBBankService();
