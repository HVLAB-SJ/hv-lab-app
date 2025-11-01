const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');

/**
 * KB국민은행 OAuth 2.0 인증 서비스
 * 실제 KB API 포털 연동
 */
class KBOAuthService {
  constructor() {
    // KB API Portal 설정
    this.authUrl = process.env.KB_AUTH_URL || 'https://apiportal.kbfg.com/sampledata/101306/1/v1';
    this.apiUrl = process.env.KB_API_URL || 'https://apiportal.kbfg.com/api';

    // OAuth 설정
    this.clientId = process.env.KB_OAUTH_CLIENT_ID;
    this.clientSecret = process.env.KB_OAUTH_CLIENT_SECRET;
    this.redirectUri = process.env.KB_OAUTH_REDIRECT_URI || 'https://hvlab.app/api/banking/kb-oauth/callback';

    // JWT 설정 (KB에서 제공하는 JWT 토큰 필요)
    this.jwtToken = process.env.KB_JWT_TOKEN;

    // 암호화 키 (토큰 저장용)
    this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
  }

  /**
   * OAuth 인증 URL 생성
   * 사용자가 KB 로그인 페이지로 이동할 URL
   */
  getAuthorizationUrl(userId) {
    const state = this.generateState(userId);

    const params = {
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'transfer inquiry account', // 송금, 조회, 계좌 권한
      state: state,
      auth_type: 'P', // P: 개인, C: 법인
      grant_type: 'authorization_code'
    };

    return `${this.authUrl}/anyid/oauth/authorize?${querystring.stringify(params)}`;
  }

  /**
   * OAuth 인증 URL 생성 (법인용)
   */
  getCorporateAuthorizationUrl(userId) {
    const state = this.generateState(userId);

    const params = {
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'transfer inquiry account bulk', // 법인용 권한 (대량이체 포함)
      state: state,
      auth_type: 'C', // 법인
      grant_type: 'authorization_code'
    };

    return `${this.authUrl}/anyid/oauth/authorize?${querystring.stringify(params)}`;
  }

  /**
   * Access Token 발급 (Authorization Code 사용)
   */
  async getAccessToken(authCode) {
    try {
      const tokenUrl = `${this.authUrl}/anyid/oauth/token`;

      const requestData = {
        grant_type: 'authorization_code',
        code: authCode,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri
      };

      console.log('[KB OAuth] Requesting access token...');

      const response = await axios.post(
        tokenUrl,
        querystring.stringify(requestData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${this.jwtToken}` // KB에서 발급받은 JWT 토큰
          }
        }
      );

      console.log('[KB OAuth] Token response:', response.data);

      return {
        success: true,
        data: {
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          token_type: response.data.token_type || 'Bearer',
          expires_in: response.data.expires_in || 3600,
          scope: response.data.scope,
          user_seq_no: response.data.user_seq_no // KB 사용자 식별번호
        }
      };
    } catch (error) {
      console.error('[KB OAuth] Get token error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Access Token 갱신 (Refresh Token 사용)
   */
  async refreshAccessToken(refreshToken) {
    try {
      const tokenUrl = `${this.authUrl}/anyid/oauth/token`;

      const requestData = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      };

      const response = await axios.post(
        tokenUrl,
        querystring.stringify(requestData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${this.jwtToken}`
          }
        }
      );

      return {
        success: true,
        data: {
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          expires_in: response.data.expires_in || 3600
        }
      };
    } catch (error) {
      console.error('[KB OAuth] Refresh token error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * 계좌 실명 조회 (송금 전 확인용)
   */
  async verifyAccount(accessToken, bankCode, accountNumber) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/v1/account/verify`,
        {
          bank_code_std: bankCode,
          account_num: accountNumber,
          tran_dtime: this.getCurrentDateTime()
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.rsp_code === 'A0000') {
        return {
          success: true,
          accountHolder: response.data.account_holder_name,
          verified: true
        };
      } else {
        return {
          success: false,
          error: response.data.rsp_message || '계좌 확인 실패'
        };
      }
    } catch (error) {
      console.error('[KB OAuth] Account verify error:', error);
      return {
        success: false,
        error: '계좌 확인 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * 즉시 송금 실행
   */
  async executeTransfer(accessToken, params) {
    const {
      fromAccount,      // 출금계좌
      toAccount,        // 입금계좌
      toBankCode,       // 입금은행코드
      toAccountHolder,  // 수취인명
      amount,           // 송금액
      memo              // 메모
    } = params;

    try {
      const transactionId = this.generateTransactionId();

      const response = await axios.post(
        `${this.apiUrl}/v1/transfer/instant`,
        {
          cntr_account_num: fromAccount,
          cntr_account_type: '1', // 1: 보통예금
          wd_pass_phrase: memo || '송금',
          wd_print_content: memo || '송금',
          recv_bank_code_std: toBankCode,
          recv_account_num: toAccount,
          recv_client_name: toAccountHolder,
          tran_amt: String(amount),
          tran_dtime: this.getCurrentDateTime(),
          req_client_num: transactionId,
          transfer_purpose: 'TR' // TR: 일반송금
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Transaction-Id': transactionId
          }
        }
      );

      if (response.data.rsp_code === 'A0000') {
        return {
          success: true,
          data: {
            transactionId: response.data.api_tran_id,
            tranDtime: response.data.api_tran_dtm,
            amount: amount,
            message: '송금이 완료되었습니다'
          }
        };
      } else {
        return {
          success: false,
          error: {
            code: response.data.rsp_code,
            message: response.data.rsp_message || '송금 실패'
          }
        };
      }
    } catch (error) {
      console.error('[KB OAuth] Transfer error:', error.response?.data || error);
      return {
        success: false,
        error: {
          code: 'TRANSFER_ERROR',
          message: '송금 처리 중 오류가 발생했습니다'
        }
      };
    }
  }

  /**
   * 계좌 잔액 조회
   */
  async getBalance(accessToken, accountNumber) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/v1/account/balance`,
        {
          bank_code_std: '004', // KB국민은행
          account_num: accountNumber,
          tran_dtime: this.getCurrentDateTime()
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.rsp_code === 'A0000') {
        return {
          success: true,
          balance: parseInt(response.data.balance_amt),
          availableBalance: parseInt(response.data.available_amt)
        };
      } else {
        return {
          success: false,
          error: response.data.rsp_message || '잔액 조회 실패'
        };
      }
    } catch (error) {
      console.error('[KB OAuth] Balance error:', error);
      return {
        success: false,
        error: '잔액 조회 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * State 생성 (CSRF 방지)
   */
  generateState(userId) {
    const random = crypto.randomBytes(16).toString('hex');
    return `${userId}_${random}_${Date.now()}`;
  }

  /**
   * 거래 고유번호 생성
   */
  generateTransactionId() {
    const prefix = 'HVLAB';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${timestamp}${random}`;
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
   * 토큰 암호화 (DB 저장용)
   */
  encryptToken(token) {
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 토큰 복호화
   */
  decryptToken(encryptedToken) {
    const algorithm = 'aes-256-cbc';
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(algorithm, this.encryptionKey, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

module.exports = new KBOAuthService();