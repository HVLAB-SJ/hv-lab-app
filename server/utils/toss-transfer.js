const axios = require('axios');

/**
 * 토스페이먼츠 계좌이체 API
 *
 * 사전 요구사항:
 * 1. 토스페이먼츠 가입: https://www.tosspayments.com
 * 2. 계좌이체 서비스 신청
 * 3. Client Key와 Secret Key 발급
 *
 * .env 파일에 다음 설정 필요:
 * TOSS_CLIENT_KEY=test_ck_* (테스트) 또는 live_ck_* (프로덕션)
 * TOSS_SECRET_KEY=test_sk_* (테스트) 또는 live_sk_* (프로덕션)
 */

class TossTransferService {
  constructor() {
    this.clientKey = process.env.TOSS_CLIENT_KEY;
    this.secretKey = process.env.TOSS_SECRET_KEY;
    this.baseURL = 'https://api.tosspayments.com/v1';
  }

  /**
   * Base64 인코딩된 인증 헤더 생성
   */
  getAuthHeader() {
    const credentials = Buffer.from(`${this.secretKey}:`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * 계좌이체 요청
   * @param {Object} params - 이체 정보
   * @param {string} params.orderId - 주문 ID (고유값)
   * @param {string} params.orderName - 주문명
   * @param {number} params.amount - 이체 금액
   * @param {string} params.customerName - 고객명 (수취인)
   * @param {string} params.bankCode - 은행 코드
   * @param {string} params.accountNumber - 계좌번호
   * @param {string} params.successUrl - 성공 콜백 URL
   * @param {string} params.failUrl - 실패 콜백 URL
   * @returns {Promise<Object>} - 이체 요청 결과
   */
  async requestTransfer(params) {
    try {
      if (!this.secretKey) {
        throw new Error('TOSS_SECRET_KEY가 설정되지 않았습니다.');
      }

      const {
        orderId,
        orderName,
        amount,
        customerName,
        bankCode,
        accountNumber,
        successUrl,
        failUrl
      } = params;

      // 필수 파라미터 검증
      if (!orderId || !orderName || !amount || !customerName || !bankCode || !accountNumber) {
        throw new Error('필수 파라미터가 누락되었습니다.');
      }

      // 토스페이먼츠 계좌이체 API 호출
      const response = await axios.post(
        `${this.baseURL}/payments`,
        {
          method: 'TRANSFER',
          orderId: orderId,
          orderName: orderName,
          amount: amount,
          customerName: customerName,
          bank: {
            code: bankCode,
            accountNumber: accountNumber
          },
          successUrl: successUrl || `${process.env.APP_URL}/payments?status=success`,
          failUrl: failUrl || `${process.env.APP_URL}/payments?status=fail`
        },
        {
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        paymentKey: response.data.paymentKey,
        orderId: response.data.orderId,
        status: response.data.status,
        checkoutUrl: response.data.checkoutUrl,
        requestedAt: response.data.requestedAt
      };

    } catch (error) {
      console.error('토스페이먼츠 이체 요청 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        errorCode: error.response?.data?.code
      };
    }
  }

  /**
   * 이체 승인
   * @param {string} paymentKey - 결제 키
   * @param {string} orderId - 주문 ID
   * @param {number} amount - 결제 금액
   * @returns {Promise<Object>} - 승인 결과
   */
  async confirmTransfer(paymentKey, orderId, amount) {
    try {
      const response = await axios.post(
        `${this.baseURL}/payments/confirm`,
        {
          paymentKey: paymentKey,
          orderId: orderId,
          amount: amount
        },
        {
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        paymentKey: response.data.paymentKey,
        orderId: response.data.orderId,
        status: response.data.status,
        approvedAt: response.data.approvedAt,
        receipt: response.data.receipt
      };

    } catch (error) {
      console.error('토스페이먼츠 승인 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * 이체 취소
   * @param {string} paymentKey - 결제 키
   * @param {string} cancelReason - 취소 사유
   * @returns {Promise<Object>} - 취소 결과
   */
  async cancelTransfer(paymentKey, cancelReason) {
    try {
      const response = await axios.post(
        `${this.baseURL}/payments/${paymentKey}/cancel`,
        {
          cancelReason: cancelReason || '고객 요청'
        },
        {
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        paymentKey: response.data.paymentKey,
        orderId: response.data.orderId,
        status: response.data.status,
        canceledAt: response.data.canceledAt
      };

    } catch (error) {
      console.error('토스페이먼츠 취소 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * 이체 조회
   * @param {string} paymentKey - 결제 키
   * @returns {Promise<Object>} - 조회 결과
   */
  async getTransferStatus(paymentKey) {
    try {
      const response = await axios.get(
        `${this.baseURL}/payments/${paymentKey}`,
        {
          headers: {
            'Authorization': this.getAuthHeader()
          }
        }
      );

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      console.error('토스페이먼츠 조회 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * 은행 코드 매핑 (한글 은행명 → 토스 은행 코드)
   */
  getBankCode(bankName) {
    const bankCodes = {
      '국민은행': '004',
      'KB국민은행': '004',
      '신한은행': '088',
      '우리은행': '020',
      '하나은행': '081',
      'NH농협은행': '011',
      '농협은행': '011',
      'IBK기업은행': '003',
      '기업은행': '003',
      'SC제일은행': '023',
      '제일은행': '023',
      '한국씨티은행': '027',
      '씨티은행': '027',
      '경남은행': '039',
      '광주은행': '034',
      '대구은행': '031',
      '부산은행': '032',
      '전북은행': '037',
      '제주은행': '035',
      '케이뱅크': '089',
      '카카오뱅크': '090',
      '토스뱅크': '092',
      'KDB산업은행': '002',
      '산업은행': '002',
      '수협은행': '007',
      '새마을금고': '045',
      '신협': '048',
      '우체국': '071'
    };

    return bankCodes[bankName] || null;
  }
}

module.exports = new TossTransferService();
