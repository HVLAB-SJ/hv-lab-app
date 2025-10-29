/**
 * CoolSMS SMS 발송 서비스
 * HV LAB 결제요청 알림
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

class CoolSMSService {
    constructor() {
        // CoolSMS 인증 정보
        this.apiKey = process.env.COOLSMS_API_KEY;
        this.apiSecret = process.env.COOLSMS_API_SECRET;
        this.from = process.env.COOLSMS_FROM_NUMBER || '01074088864';

        // 관리자 전화번호 목록
        this.adminPhones = process.env.ADMIN_PHONE_NUMBERS ?
            process.env.ADMIN_PHONE_NUMBERS.split(',').map(p => p.trim()) : ['01074088864'];

        if (this.apiKey && this.apiSecret) {
            console.log('✅ CoolSMS 서비스가 초기화되었습니다.');
            console.log(`📞 관리자 전화번호: ${this.adminPhones.length}개 등록됨`);
            console.log(`📱 발신번호: ${this.from}`);
        } else {
            console.warn('⚠️ CoolSMS API 키가 설정되지 않았습니다. SMS 기능이 비활성화됩니다.');
        }
    }

    /**
     * CoolSMS API 인증 정보 생성
     */
    getAuthHeaders() {
        const date = new Date().toISOString();
        const salt = crypto.randomBytes(16).toString('hex');
        const signature = crypto
            .createHmac('sha256', this.apiSecret)
            .update(date + salt)
            .digest('hex');

        return {
            'Authorization': `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * SMS 발송
     * @param {string} to - 수신번호
     * @param {string} text - 메시지 내용
     */
    async sendSMS(to, text) {
        if (!this.apiKey || !this.apiSecret) {
            console.error('❌ CoolSMS API 키가 설정되지 않았습니다.');
            return { success: false, error: 'API key not configured' };
        }

        try {
            // CoolSMS API v4 형식 - 단일 메시지
            const data = {
                message: {
                    to: to.replace(/-/g, ''),
                    from: this.from.replace(/-/g, ''),
                    text: text
                }
            };

            console.log('📤 [CoolSMS] 발송 요청 데이터:', JSON.stringify(data, null, 2));

            const response = await axios.post(
                'https://api.coolsms.co.kr/messages/v4/send',
                data,
                { headers: this.getAuthHeaders() }
            );

            console.log(`✅ SMS 발송 성공: ${to}`, response.data);
            return { success: true, response: response.data };
        } catch (error) {
            console.error(`❌ SMS 발송 실패 (${to}):`, error.response?.data || error.message);
            if (error.response) {
                console.error('❌ 응답 상태:', error.response.status);
                console.error('❌ 응답 데이터:', JSON.stringify(error.response.data, null, 2));
            }
            return { success: false, error: error.message, details: error.response?.data };
        }
    }

    /**
     * 결제요청 알림 SMS 발송
     * @param {Object} data - 결제 요청 데이터
     */
    async sendPaymentNotification(data) {
        console.log('📱 [CoolSMS] sendPaymentNotification 호출됨');
        console.log('📱 [CoolSMS] 데이터:', JSON.stringify(data, null, 2));

        if (!this.apiKey || !this.apiSecret) {
            console.error('❌ [CoolSMS] API 키가 설정되지 않았습니다.');
            return { success: false, error: 'API key not configured' };
        }

        const results = [];

        // SMS 메시지 생성
        const message = this.createPaymentMessage(data);

        // 각 관리자에게 SMS 발송
        console.log(`📱 [CoolSMS] 총 ${this.adminPhones.length}명의 관리자에게 SMS 발송 시작`);
        for (const phoneNumber of this.adminPhones) {
            try {
                console.log(`📤 [CoolSMS] ${phoneNumber}로 SMS 발송 시도...`);
                const result = await this.sendSMS(phoneNumber, message);
                results.push({
                    phone: phoneNumber,
                    success: result.success,
                    response: result.response
                });
            } catch (error) {
                console.error(`❌ [CoolSMS] SMS 발송 실패 (${phoneNumber}):`, error);
                results.push({
                    phone: phoneNumber,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * 결제요청 SMS 메시지 생성
     * @param {Object} data - 결제 요청 데이터
     */
    createPaymentMessage(data) {
        let message = '[HV LAB 결제요청]\n';
        message += `프로젝트: ${data.projectName || '미지정'}\n`;
        message += `금액: ${this.formatAmount(data.amount)}원\n`;

        if (data.itemName) {
            message += `항목: ${data.itemName}\n`;
        }

        if (data.accountHolder && data.bankName && data.accountNumber) {
            message += `\n${data.bankName}\n`;
            message += `${data.accountNumber}\n`;
            message += `예금주: ${data.accountHolder}`;
        }

        return message;
    }

    /**
     * 금액 포맷팅 (천단위 콤마)
     * @param {number} amount - 금액
     */
    formatAmount(amount) {
        if (!amount) return '0';
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
}

module.exports = new CoolSMSService();
