const axios = require('axios');

class KakaoNotification {
    constructor() {
        // 카카오 API 정보 (실제 값으로 교체 필요)
        this.API_KEY = process.env.KAKAO_API_KEY || 'YOUR_API_KEY';
        this.SENDER_KEY = process.env.KAKAO_SENDER_KEY || 'YOUR_SENDER_KEY';
        this.TEMPLATE_CODE = process.env.KAKAO_TEMPLATE_CODE || 'payment_request_001';
    }

    /**
     * 알림톡 발송
     * @param {string} phoneNumber - 수신자 전화번호 (010-1234-5678)
     * @param {object} params - 템플릿 변수
     */
    async sendAlimtalk(phoneNumber, params) {
        try {
            // 전화번호 형식 정리 (하이픈 제거)
            const phone = phoneNumber.replace(/-/g, '');

            const requestData = {
                senderKey: this.SENDER_KEY,
                templateCode: this.TEMPLATE_CODE,
                recipientList: [{
                    recipientNo: phone,
                    templateParameter: {
                        회사명: 'HV LAB',
                        요청자명: params.requesterName,
                        현장명: params.projectName,
                        금액: params.amount.toLocaleString(),
                        요청내용: params.description
                    }
                }]
            };

            // 알림톡 API 호출
            const response = await axios.post(
                'https://api-alimtalk.cloud.toast.com/alimtalk/v2.0/appkeys/' + this.API_KEY + '/messages',
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8'
                    }
                }
            );

            console.log('알림톡 발송 성공:', response.data);
            return { success: true, data: response.data };

        } catch (error) {
            console.error('알림톡 발송 실패:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 결제 요청 알림 발송
     */
    async notifyPaymentRequest(payment, adminPhoneNumbers) {
        const params = {
            requesterName: payment.requester_name,
            projectName: payment.project_name || '미지정',
            amount: payment.amount,
            description: payment.description
        };

        // 관리자들에게 알림 발송
        const results = await Promise.all(
            adminPhoneNumbers.map(phone => this.sendAlimtalk(phone, params))
        );

        return results;
    }

    /**
     * 결제 승인 알림
     */
    async notifyPaymentApproval(payment, requesterPhone) {
        const message = `[결제 승인]\n` +
                       `요청하신 ${payment.amount.toLocaleString()}원이 승인되었습니다.\n` +
                       `현장: ${payment.project_name}`;

        return this.sendSimpleMessage(requesterPhone, message);
    }

    /**
     * 단순 메시지 발송 (친구톡)
     */
    async sendSimpleMessage(phoneNumber, message) {
        // 친구톡 API 사용 (채널 친구인 경우만 가능)
        try {
            const response = await axios.post(
                'https://kapi.kakao.com/v1/api/talk/friends/message/send',
                {
                    receiver_uuids: [phoneNumber],
                    template_object: {
                        object_type: 'text',
                        text: message
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.API_KEY}`
                    }
                }
            );

            return { success: true, data: response.data };
        } catch (error) {
            console.error('메시지 발송 실패:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new KakaoNotification();