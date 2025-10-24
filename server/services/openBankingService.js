const axios = require('axios');
const crypto = require('crypto');

/**
 * 오픈뱅킹 API 서비스
 * 금융결제원 오픈뱅킹 시스템 연동
 */
class OpenBankingService {
  constructor() {
    // 테스트베드 URL (상용 전환 시 변경 필요)
    this.baseURL = process.env.OPENBANKING_API_URL || 'https://testapi.openbanking.or.kr';
    this.clientId = process.env.OPENBANKING_CLIENT_ID;
    this.clientSecret = process.env.OPENBANKING_CLIENT_SECRET;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * OAuth 2.0 인증 URL 생성
   */
  getAuthorizationUrl(userId) {
    const state = this.generateState(userId);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: process.env.OPENBANKING_REDIRECT_URI,
      scope: 'inquiry transfer',
      state: state,
      auth_type: '0' // 0: 최초인증, 2: 재인증
    });

    return `${this.baseURL}/oauth/2.0/authorize?${params.toString()}`;
  }

  /**
   * Access Token 발급
   */
  async getAccessToken(authCode) {
    try {
      const response = await axios.post(
        `${this.baseURL}/oauth/2.0/token`,
        new URLSearchParams({
          code: authCode,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: process.env.OPENBANKING_REDIRECT_URI,
          grant_type: 'authorization_code'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Get access token error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Access Token 갱신
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(
        `${this.baseURL}/oauth/2.0/token`,
        new URLSearchParams({
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Refresh token error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * 잔액 조회
   */
  async getBalance(accessToken, fintechUseNum) {
    try {
      const bankTranId = this.generateTransactionId();
      const tranDtime = this.getCurrentDateTime();

      const response = await axios.get(
        `${this.baseURL}/v2.0/account/balance/fin_num`,
        {
          params: {
            bank_tran_id: bankTranId,
            fintech_use_num: fintechUseNum,
            tran_dtime: tranDtime
          },
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Get balance error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * 출금이체 (송금)
   */
  async transfer(params) {
    const {
      accessToken,
      fintechUseNum,      // 출금계좌 핀테크이용번호
      bankCode,           // 입금은행코드
      accountNumber,      // 입금계좌번호
      accountHolder,      // 입금계좌 예금주명
      amount,             // 송금액
      purpose,            // 송금 목적
      withdrawAccountHolder, // 출금계좌 예금주명
      reqClientNum        // 요청고객회원번호 (사용자 ID)
    } = params;

    try {
      const bankTranId = this.generateTransactionId();
      const tranDtime = this.getCurrentDateTime();

      const requestData = {
        bank_tran_id: bankTranId,
        cntr_account_type: 'N',
        cntr_account_num: fintechUseNum,
        dps_print_content: this.truncate(purpose, 16), // 입금계좌인자내역 (최대 16자)
        fintech_use_num: fintechUseNum,
        wd_print_content: this.truncate(purpose, 16),  // 출금계좌인자내역 (최대 16자)
        tran_amt: String(amount),
        tran_dtime: tranDtime,
        req_client_name: withdrawAccountHolder,
        req_client_fintech_use_num: fintechUseNum,
        req_client_num: reqClientNum,
        transfer_purpose: 'TR', // TR: 송금
        recv_client_name: accountHolder,
        recv_client_bank_code: bankCode,
        recv_client_account_num: accountNumber
      };

      console.log('[OpenBanking] Transfer request:', {
        bankTranId,
        amount,
        purpose,
        to: `${bankCode}-${accountNumber}`
      });

      const response = await axios.post(
        `${this.baseURL}/v2.0/transfer/withdraw/fin_num`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('[OpenBanking] Transfer response:', response.data);

      // 응답 코드 확인
      if (response.data.rsp_code === 'A0000') {
        return {
          success: true,
          data: {
            transactionId: bankTranId,
            amount: amount,
            timestamp: tranDtime,
            message: '송금이 완료되었습니다',
            details: response.data
          }
        };
      } else {
        return {
          success: false,
          error: {
            code: response.data.rsp_code,
            message: response.data.rsp_message || '송금에 실패했습니다'
          }
        };
      }
    } catch (error) {
      console.error('[OpenBanking] Transfer error:', error.response?.data || error);
      return {
        success: false,
        error: {
          code: error.response?.data?.rsp_code || 'TRANSFER_ERROR',
          message: error.response?.data?.rsp_message || '송금 처리 중 오류가 발생했습니다',
          details: error.response?.data
        }
      };
    }
  }

  /**
   * 거래내역 조회
   */
  async getTransactionHistory(accessToken, fintechUseNum, fromDate, toDate) {
    try {
      const bankTranId = this.generateTransactionId();
      const tranDtime = this.getCurrentDateTime();

      const response = await axios.get(
        `${this.baseURL}/v2.0/account/transaction_list/fin_num`,
        {
          params: {
            bank_tran_id: bankTranId,
            fintech_use_num: fintechUseNum,
            inquiry_type: 'A', // A: 전체, I: 입금, O: 출금
            inquiry_base: 'D', // D: 일자, T: 시간
            from_date: fromDate,
            to_date: toDate,
            sort_order: 'D', // D: 내림차순, A: 오름차순
            tran_dtime: tranDtime
          },
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Get transaction history error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * 거래 고유번호 생성 (기관코드 9자리 + YYYYMMDD 8자리 + 일련번호 9자리)
   */
  generateTransactionId() {
    const institutionCode = process.env.OPENBANKING_INSTITUTION_CODE || 'M202401234'; // 9자리
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const sequenceNum = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0'); // 9자리

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
   * State 값 생성 (보안을 위한 랜덤 문자열)
   */
  generateState(userId) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    return `${userId}_${timestamp}_${random}`;
  }

  /**
   * 문자열 자르기 (바이트 단위)
   */
  truncate(str, maxBytes) {
    if (!str) return '';

    let bytes = 0;
    let result = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      // 한글은 3바이트, 영문/숫자는 1바이트
      bytes += /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(char) ? 3 : 1;

      if (bytes > maxBytes) break;
      result += char;
    }

    return result;
  }

  /**
   * 토큰 암호화 (저장용)
   */
  encryptToken(token) {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars', 'utf8');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key.slice(0, 32), iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 토큰 복호화
   */
  decryptToken(encryptedToken) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars', 'utf8');

      const parts = encryptedToken.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(algorithm, key.slice(0, 32), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decrypt token error:', error);
      return null;
    }
  }
}

module.exports = new OpenBankingService();
