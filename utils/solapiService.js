/**
 * SOLAPI 알림톡 및 SMS 발송 서비스
 * HV LAB 정산 비즈니스 채널 연동
 */

const { SolapiMessageService } = require('solapi');
require('dotenv').config();

class SolapiNotificationService {
    constructor() {
        // SOLAPI 인증 정보
        this.apiKey = process.env.SOLAPI_API_KEY;
        this.apiSecret = process.env.SOLAPI_API_SECRET;
        this.pfId = process.env.SOLAPI_PFID || 'KA01PF251010200623410stJ4ZpKzQLv'; // 채널 ID
        this.templateId = process.env.SOLAPI_TEMPLATE_ID || 'KA01TP2510102016192182Rh5igI5PtG'; // 템플릿 ID
        this.from = process.env.SOLAPI_FROM_NUMBER || '01000000000'; // 발신번호

        // 관리자 전화번호 목록 (환경변수에서 콤마로 구분된 문자열로 가져오기)
        this.adminPhones = process.env.ADMIN_PHONE_NUMBERS ?
            process.env.ADMIN_PHONE_NUMBERS.split(',').map(p => p.trim()) : [];

        // SOLAPI 서비스 초기화
        if (this.apiKey && this.apiSecret) {
            this.messageService = new SolapiMessageService(this.apiKey, this.apiSecret);
            console.log('✅ SOLAPI 서비스가 초기화되었습니다.');
            console.log(`📞 관리자 전화번호: ${this.adminPhones.length}개 등록됨`);
        } else {
            console.warn('⚠️ SOLAPI API 키가 설정되지 않았습니다. 알림톡 기능이 비활성화됩니다.');
            console.warn('Railway 환경변수에 다음을 설정해주세요:');
            console.warn('- SOLAPI_API_KEY');
            console.warn('- SOLAPI_API_SECRET');
            console.warn('- SOLAPI_FROM_NUMBER');
            console.warn('- ADMIN_PHONE_NUMBERS');
        }
    }

    /**
     * 알림톡 발송 (결제 요청)
     * @param {Object} data - 결제 요청 데이터
     * @param {boolean} isUrgent - 긴급 여부
     */
    async sendPaymentNotification(data, isUrgent = false) {
        console.log('📱 [SOLAPI] sendPaymentNotification 호출됨');
        console.log('📱 [SOLAPI] 데이터:', JSON.stringify(data, null, 2));
        console.log('📱 [SOLAPI] 긴급여부:', isUrgent);
        console.log('📱 [SOLAPI] API Key 설정:', !!this.apiKey);
        console.log('📱 [SOLAPI] API Secret 설정:', !!this.apiSecret);
        console.log('📱 [SOLAPI] 발신번호:', this.from);
        console.log('📱 [SOLAPI] 수신번호 목록:', this.adminPhones);

        if (!this.messageService) {
            console.error('❌ [SOLAPI] 서비스가 초기화되지 않았습니다.');
            console.error('❌ [SOLAPI] API Key:', this.apiKey ? '설정됨' : '없음');
            console.error('❌ [SOLAPI] API Secret:', this.apiSecret ? '설정됨' : '없음');
            return { success: false, error: 'SOLAPI not initialized' };
        }

        if (this.adminPhones.length === 0) {
            console.error('❌ [SOLAPI] 수신 전화번호가 설정되지 않았습니다.');
            console.error('❌ [SOLAPI] ADMIN_PHONE_NUMBERS 환경변수를 확인하세요.');
            return { success: false, error: 'No admin phone numbers configured' };
        }

        const results = [];

        // 템플릿 변수 설정
        const templateVariables = {
            urgency: isUrgent ? '⚠️ 긴급 결제 요청' : '',
            project: data.projectName || '프로젝트',
            amount: this.formatAmount(data.amount) || '0',
            accountHolder: data.accountHolder || '',
            bankName: data.bankName || '',
            accountNumber: data.accountNumber || ''
        };

        // 각 관리자에게 알림톡 발송
        for (const phoneNumber of this.adminPhones) {
            try {
                console.log(`📤 [SOLAPI] ${phoneNumber}로 알림톡 발송 시도...`);

                // 알림톡 메시지 구성
                const message = {
                    to: phoneNumber,
                    from: this.from,
                    type: 'ATA',  // 알림톡 타입 명시
                    kakaoOptions: {
                        pfId: this.pfId,
                        templateId: this.templateId,
                        variables: templateVariables
                    }
                };

                console.log('📤 [SOLAPI] 메시지 객체:', JSON.stringify(message, null, 2));

                // 알림톡 발송
                const response = await this.messageService.send([message]);

                console.log(`✅ [SOLAPI] 알림톡 발송 응답:`, JSON.stringify(response, null, 2));
                results.push({
                    phone: phoneNumber,
                    type: 'alimtalk',
                    success: true,
                    response: response
                });

                // 긴급 요청인 경우 SMS도 추가 발송
                if (isUrgent) {
                    await this.sendUrgentSMS(phoneNumber, data);
                    results.push({
                        phone: phoneNumber,
                        type: 'sms',
                        success: true
                    });
                }

            } catch (error) {
                console.error(`❌ [SOLAPI] 알림톡 발송 실패 (${phoneNumber}):`, error);
                console.error(`❌ [SOLAPI] 오류 상세:`, {
                    message: error.message,
                    response: error.response?.data,
                    status: error.response?.status
                });

                // 알림톡 실패 시 SMS로 대체 발송 시도
                try {
                    console.log(`📱 [SOLAPI] SMS로 대체 발송 시도...`);
                    await this.sendFallbackSMS(phoneNumber, data, isUrgent);
                    results.push({
                        phone: phoneNumber,
                        type: 'sms-fallback',
                        success: true
                    });
                } catch (smsError) {
                    console.error(`❌ [SOLAPI] SMS도 실패:`, smsError);
                    results.push({
                        phone: phoneNumber,
                        type: 'failed',
                        success: false,
                        error: smsError.message
                    });
                }
            }
        }

        return results;
    }

    /**
     * 긴급 SMS 발송
     * @param {string} phoneNumber - 수신자 전화번호
     * @param {Object} data - 결제 요청 데이터
     */
    async sendUrgentSMS(phoneNumber, data) {
        const message = this.createUrgentSMSMessage(data);

        const smsOptions = {
            to: phoneNumber,
            from: this.from,
            text: message,
            type: 'SMS'
        };

        try {
            const response = await this.messageService.send([smsOptions]);
            console.log(`📱 긴급 SMS 발송 성공: ${phoneNumber}`);
            return response;
        } catch (error) {
            console.error(`❌ 긴급 SMS 발송 실패: ${error.message}`);
            throw error;
        }
    }

    /**
     * 알림톡 실패 시 대체 SMS 발송
     * @param {string} phoneNumber - 수신자 전화번호
     * @param {Object} data - 결제 요청 데이터
     * @param {boolean} isUrgent - 긴급 여부
     */
    async sendFallbackSMS(phoneNumber, data, isUrgent) {
        const message = this.createSMSMessage(data, isUrgent);

        const smsOptions = {
            to: phoneNumber,
            from: this.from,
            text: message,
            type: 'LMS' // 90바이트 이상일 경우 LMS로 자동 전환
        };

        try {
            const response = await this.messageService.send([smsOptions]);
            console.log(`📱 대체 SMS 발송 성공: ${phoneNumber}`);
            return response;
        } catch (error) {
            console.error(`❌ 대체 SMS 발송 실패: ${error.message}`);
            throw error;
        }
    }

    /**
     * SMS 메시지 생성
     * @param {Object} data - 결제 요청 데이터
     * @param {boolean} isUrgent - 긴급 여부
     */
    createSMSMessage(data, isUrgent) {
        let message = isUrgent ? '[긴급] ' : '';
        message += `HV LAB 결제요청\n`;
        message += `${data.projectName}\n`;
        message += `${this.formatAmount(data.amount)}원\n`;

        if (data.bankName && data.accountNumber) {
            message += `${data.bankName} ${data.accountNumber}\n`;
            message += `예금주: ${data.accountHolder}`;
        }

        return message;
    }

    /**
     * 긴급 SMS 메시지 생성 (더 간결하게)
     * @param {Object} data - 결제 요청 데이터
     */
    createUrgentSMSMessage(data) {
        return `[HV LAB 긴급]\n${data.projectName}\n${this.formatAmount(data.amount)}원 결제요청\n즉시 확인 요망`;
    }

    /**
     * 결제 완료 알림톡 발송
     * @param {Object} data - 결제 완료 데이터
     */
    async sendPaymentCompleteNotification(data) {
        // 추후 결제 완료 템플릿 추가 시 구현
        console.log('결제 완료 알림 - 준비 중');
        return { success: true, message: 'Payment complete notification - Coming soon' };
    }

    /**
     * 금액 포맷팅 (천단위 콤마)
     * @param {number} amount - 금액
     */
    formatAmount(amount) {
        if (!amount) return '0';
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * 전화번호 검증 및 포맷팅
     * @param {string} phoneNumber - 전화번호
     */
    formatPhoneNumber(phoneNumber) {
        // 하이픈 제거
        const cleaned = phoneNumber.replace(/[-\s]/g, '');

        // 한국 전화번호 형식 확인 (01X로 시작하는 10-11자리)
        if (!/^01[0-9]{8,9}$/.test(cleaned)) {
            throw new Error(`잘못된 전화번호 형식: ${phoneNumber}`);
        }

        return cleaned;
    }

    /**
     * 관리자 전화번호 목록 업데이트
     * @param {Array} phoneNumbers - 전화번호 배열
     */
    updateAdminPhones(phoneNumbers) {
        this.adminPhones = phoneNumbers.map(phone => this.formatPhoneNumber(phone));
        console.log('관리자 전화번호 목록 업데이트:', this.adminPhones);
    }

    /**
     * 테스트 메시지 발송
     * @param {string} phoneNumber - 테스트 수신 번호
     */
    async sendTestMessage(phoneNumber) {
        const testData = {
            projectName: '테스트 프로젝트',
            amount: 1234567,
            accountHolder: '홍길동',
            bankName: 'KB국민은행',
            accountNumber: '123-456-789012'
        };

        console.log('📧 테스트 메시지 발송 시작...');
        const results = await this.sendPaymentNotification(testData, true);
        console.log('테스트 결과:', results);
        return results;
    }
}

module.exports = new SolapiNotificationService();