const axios = require('axios');

/**
 * 카카오페이 송금 API 유틸리티
 *
 * 사전 요구사항:
 * 1. 카카오페이 비즈니스 계정 필요
 * 2. 송금 서비스 이용 계약 필요
 * 3. Admin Key 발급 필요
 *
 * .env 파일에 다음 설정 필요:
 * KAKAOPAY_ADMIN_KEY=발급받은_Admin_Key
 * KAKAOPAY_CID=가맹점_코드
 */

class KakaoPayTransfer {
  constructor() {
    this.adminKey = process.env.KAKAOPAY_ADMIN_KEY;
    this.cid = process.env.KAKAOPAY_CID || 'TC0ONETIME';
    this.baseURL = 'https://kapi.kakao.com';
  }

  /**
   * 카카오페이 송금 요청
   * @param {Object} params - 송금 정보
   * @param {string} params.receiverName - 수신자 이름
   * @param {string} params.receiverPhone - 수신자 전화번호 (01012345678 형식)
   * @param {string} params.receiverBank - 은행 코드 (KB, SC, NH 등)
   * @param {string} params.receiverAccount - 계좌번호
   * @param {number} params.amount - 송금 금액
   * @param {string} params.description - 송금 설명
   * @returns {Promise<Object>} - 송금 결과
   */
  async requestTransfer(params) {
    try {
      if (!this.adminKey) {
        throw new Error('KAKAOPAY_ADMIN_KEY가 설정되지 않았습니다.');
      }

      const {
        receiverName,
        receiverPhone,
        receiverBank,
        receiverAccount,
        amount,
        description
      } = params;

      // 입력 값 검증
      if (!receiverName || !receiverPhone || !receiverBank || !receiverAccount || !amount) {
        throw new Error('필수 파라미터가 누락되었습니다.');
      }

      // 카카오페이 송금 API 호출
      const response = await axios.post(
        `${this.baseURL}/v1/payment/ready`,
        {
          cid: this.cid,
          partner_order_id: `TRANSFER_${Date.now()}`,
          partner_user_id: receiverPhone,
          item_name: description || '송금',
          quantity: 1,
          total_amount: amount,
          tax_free_amount: 0,
          approval_url: `${process.env.APP_URL || 'http://localhost:3000'}/payments/kakaopay/success`,
          cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/payments/kakaopay/cancel`,
          fail_url: `${process.env.APP_URL || 'http://localhost:3000'}/payments/kakaopay/fail`,
          // 송금 전용 파라미터
          payment_method_type: 'MONEY',
          receiver: {
            name: receiverName,
            phone: receiverPhone,
            bank_code: receiverBank,
            account_number: receiverAccount
          }
        },
        {
          headers: {
            'Authorization': `KakaoAK ${this.adminKey}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
          }
        }
      );

      return {
        success: true,
        tid: response.data.tid,
        next_redirect_pc_url: response.data.next_redirect_pc_url,
        next_redirect_mobile_url: response.data.next_redirect_mobile_url,
        created_at: response.data.created_at
      };

    } catch (error) {
      console.error('카카오페이 송금 요청 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: error.response?.data?.msg || error.message,
        errorCode: error.response?.data?.code
      };
    }
  }

  /**
   * 송금 승인
   * @param {string} tid - 트랜잭션 ID
   * @param {string} pgToken - 결제 승인 토큰
   * @returns {Promise<Object>} - 승인 결과
   */
  async approveTransfer(tid, pgToken) {
    try {
      const response = await axios.post(
        `${this.baseURL}/v1/payment/approve`,
        {
          cid: this.cid,
          tid: tid,
          partner_order_id: `TRANSFER_${Date.now()}`,
          partner_user_id: 'ADMIN',
          pg_token: pgToken
        },
        {
          headers: {
            'Authorization': `KakaoAK ${this.adminKey}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
          }
        }
      );

      return {
        success: true,
        aid: response.data.aid,
        tid: response.data.tid,
        amount: response.data.amount.total,
        approved_at: response.data.approved_at
      };

    } catch (error) {
      console.error('카카오페이 송금 승인 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: error.response?.data?.msg || error.message
      };
    }
  }

  /**
   * 송금 취소
   * @param {string} tid - 트랜잭션 ID
   * @param {number} cancelAmount - 취소 금액
   * @returns {Promise<Object>} - 취소 결과
   */
  async cancelTransfer(tid, cancelAmount) {
    try {
      const response = await axios.post(
        `${this.baseURL}/v1/payment/cancel`,
        {
          cid: this.cid,
          tid: tid,
          cancel_amount: cancelAmount,
          cancel_tax_free_amount: 0
        },
        {
          headers: {
            'Authorization': `KakaoAK ${this.adminKey}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
          }
        }
      );

      return {
        success: true,
        tid: response.data.tid,
        cid: response.data.cid,
        status: response.data.status,
        canceled_at: response.data.canceled_at
      };

    } catch (error) {
      console.error('카카오페이 송금 취소 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: error.response?.data?.msg || error.message
      };
    }
  }
}

module.exports = new KakaoPayTransfer();
