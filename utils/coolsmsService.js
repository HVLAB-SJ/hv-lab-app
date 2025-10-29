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
                    // type을 지정하지 않으면 자동으로 메시지 길이에 따라 SMS/LMS 선택
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
        console.log('[createPaymentMessage] 받은 데이터:', JSON.stringify(data, null, 2));

        // 프로젝트명에서 앞 2글자 추출 (예: "대림아크로텔_엄상진님" -> "대림")
        const projectName = data.projectName || '프로젝트';
        const projectPrefix = projectName.substring(0, 2);

        // 공정명과 항목명
        const process = data.purpose || '';  // 공정명 (목공, 타일, 가구 등) - purpose 필드 사용
        const itemName = data.itemName ? data.itemName.replace(/\s+/g, '') : '';  // 항목명 (공백 제거)

        console.log('[createPaymentMessage] process:', process);
        console.log('[createPaymentMessage] itemName:', itemName);

        // 계좌 정보와 금액 부분 (고정)
        const bankInfo = `${data.bankName || ''} ${data.accountNumber || ''} ${data.accountHolder || ''}`;
        const amountPart = `${this.formatAmount(data.amount)}원`;

        // VAT/세금공제 표시
        let taxPart = '';
        if (data.includesVat) {
            taxPart = '(VAT)';
        } else if (data.applyTaxDeduction) {
            taxPart = '(3.3%)';
        }

        // 메시지 기본 구조 (공정/항목 제외한 부분)
        const fixedPart = `\n${bankInfo}\n${amountPart}${taxPart}`;
        const fixedBytes = Buffer.byteLength(`//\n${fixedPart}`, 'utf8');
        const projectBytes = Buffer.byteLength(projectPrefix, 'utf8');

        // 95바이트 제한에서 고정 부분을 뺀 나머지 바이트
        const availableBytes = 95 - fixedBytes - projectBytes;

        // 공정/항목명 조합
        let processContent = process || '공정';
        let itemContent = itemName || '항목';

        // 전체 내용 생성 및 바이트 체크
        let fullContent = `/${processContent}/${itemContent}`;
        let fullBytes = Buffer.byteLength(fullContent, 'utf8');

        // 95바이트 초과 시 항목명 축약
        if (fullBytes > availableBytes) {
            // 항목명을 점진적으로 줄임
            let maxItemLength = itemContent.length;
            while (fullBytes > availableBytes && maxItemLength > 0) {
                maxItemLength--;
                itemContent = itemName.substring(0, maxItemLength);
                fullContent = `/${processContent}/${itemContent}`;
                fullBytes = Buffer.byteLength(fullContent, 'utf8');
            }

            // 그래도 초과하면 공정명만
            if (fullBytes > availableBytes) {
                fullContent = `/${processContent}`;
            }
        }

        // 최종 메시지 조합
        let message = `${projectPrefix}${fullContent}\n`;
        message += `${bankInfo}\n`;
        message += `${amountPart}${taxPart}`;

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
