const axios = require('axios');

/**
 * 토스페이 송금 API
 *
 * 사전 요구사항:
 * 1. 토스뱅크 사업자 계좌 개설
 * 2. 토스페이 서비스 신청: https://toss.im/business
 * 3. API 키 발급
 *
 * .env 파일에 다음 설정 필요:
 * TOSSPAY_API_KEY=your_api_key
 * TOSSPAY_SECRET_KEY=your_secret_key
 * TOSSPAY_SENDER_ACCOUNT=1002-XXX-XXXX (토스뱅크 계좌번호)
 */

class TossPayTransferService {
  constructor() {
    this.apiKey = process.env.TOSSPAY_API_KEY;
    this.secretKey = process.env.TOSSPAY_SECRET_KEY;
    this.senderAccount = process.env.TOSSPAY_SENDER_ACCOUNT;
    this.baseURL = 'https://pay.toss.im/api/v2';
  }

  /**
   * 인증 헤더 생성
   */
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * 송금 요청
   * @param {Object} params - 송금 정보
   * @param {string} params.receiverName - 받는 사람 이름
   * @param {string} params.receiverBank - 은행명
   * @param {string} params.receiverAccount - 계좌번호
   * @param {number} params.amount - 송금 금액
   * @param {string} params.description - 송금 내역
   * @returns {Promise<Object>} - 송금 결과
   */
  async sendMoney(params) {
    try {
      if (!this.apiKey || !this.secretKey || !this.senderAccount) {
        throw new Error('토스페이 API 키 또는 송금 계좌가 설정되지 않았습니다.');
      }

      const {
        receiverName,
        receiverBank,
        receiverAccount,
        amount,
        description
      } = params;

      // 필수 파라미터 검증
      if (!receiverName || !receiverBank || !receiverAccount || !amount) {
        throw new Error('필수 파라미터가 누락되었습니다.');
      }

      // 은행 코드 변환
      const bankCode = this.getBankCode(receiverBank);
      if (!bankCode) {
        throw new Error(`지원하지 않는 은행입니다: ${receiverBank}`);
      }

      // 토스페이 송금 API 호출
      const response = await axios.post(
        `${this.baseURL}/transfer`,
        {
          senderAccount: this.senderAccount,
          receiverBank: bankCode,
          receiverAccount: receiverAccount.replace(/-/g, ''), // 하이픈 제거
          receiverName: receiverName,
          amount: amount,
          description: description || '송금',
          transferType: 'INSTANT' // 즉시송금
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return {
        success: true,
        transferId: response.data.transferId,
        status: response.data.status,
        transferredAt: response.data.transferredAt,
        message: '송금이 완료되었습니다'
      };

    } catch (error) {
      console.error('토스페이 송금 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        errorCode: error.response?.data?.code
      };
    }
  }

  /**
   * 송금 조회
   * @param {string} transferId - 송금 ID
   * @returns {Promise<Object>} - 송금 정보
   */
  async getTransferStatus(transferId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/transfer/${transferId}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      console.error('토스페이 송금 조회 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * 송금 취소
   * @param {string} transferId - 송금 ID
   * @param {string} reason - 취소 사유
   * @returns {Promise<Object>} - 취소 결과
   */
  async cancelTransfer(transferId, reason) {
    try {
      const response = await axios.post(
        `${this.baseURL}/transfer/${transferId}/cancel`,
        {
          reason: reason || '고객 요청'
        },
        {
          headers: this.getAuthHeaders()
        }
      );

      return {
        success: true,
        transferId: response.data.transferId,
        status: response.data.status,
        canceledAt: response.data.canceledAt
      };

    } catch (error) {
      console.error('토스페이 송금 취소 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * 은행 코드 매핑 (한글 은행명 → 토스페이 은행 코드)
   */
  getBankCode(bankName) {
    const bankCodes = {
      '국민은행': 'KB',
      'KB국민은행': 'KB',
      '신한은행': 'SHINHAN',
      '우리은행': 'WOORI',
      '하나은행': 'HANA',
      'NH농협은행': 'NH',
      '농협은행': 'NH',
      'IBK기업은행': 'IBK',
      '기업은행': 'IBK',
      'SC제일은행': 'SC',
      '제일은행': 'SC',
      '한국씨티은행': 'CITI',
      '씨티은행': 'CITI',
      '경남은행': 'KYONGNAM',
      '광주은행': 'GWANGJU',
      '대구은행': 'DAEGU',
      '부산은행': 'BUSAN',
      '전북은행': 'JEONBUK',
      '제주은행': 'JEJU',
      '케이뱅크': 'KBANK',
      '카카오뱅크': 'KAKAO',
      '토스뱅크': 'TOSS',
      'KDB산업은행': 'KDB',
      '산업은행': 'KDB',
      '수협은행': 'SUHYUP',
      '새마을금고': 'MG',
      '신협': 'CU',
      '우체국': 'POST'
    };

    return bankCodes[bankName] || null;
  }

  /**
   * 송금 한도 조회
   * @returns {Promise<Object>} - 한도 정보
   */
  async getTransferLimit() {
    try {
      const response = await axios.get(
        `${this.baseURL}/transfer/limit`,
        {
          headers: this.getAuthHeaders()
        }
      );

      return {
        success: true,
        dailyLimit: response.data.dailyLimit,
        remainingLimit: response.data.remainingLimit,
        usedAmount: response.data.usedAmount
      };

    } catch (error) {
      console.error('토스페이 한도 조회 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

module.exports = new TossPayTransferService();
