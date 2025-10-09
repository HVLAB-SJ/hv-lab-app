/**
 * 카카오톡 메시지 발송 유틸리티
 * 결제 관련 알림을 카카오톡으로 전송
 */

const axios = require('axios');
require('dotenv').config();
const tokenStore = require('./tokenStore');

class KakaoMessageService {
    constructor() {
        this.REST_API_KEY = process.env.KAKAO_REST_API_KEY;
        this.ADMIN_KEY = process.env.KAKAO_ADMIN_KEY;
        this.redirectUri = process.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/oauth/kakao';

        // 관리자 정보 (카카오 사용자 ID - 실제 서비스에서는 DB에서 관리)
        this.admins = process.env.KAKAO_ADMIN_IDS ? process.env.KAKAO_ADMIN_IDS.split(',') : [];

        // 파일 기반 토큰 저장소 사용
        this.tokenStore = tokenStore;
    }

    /**
     * 인증 URL 생성 (최초 1회 필요)
     */
    getAuthUrl(state = '') {
        const scope = 'talk_message';
        return `https://kauth.kakao.com/oauth/authorize?client_id=${this.REST_API_KEY}&redirect_uri=${this.redirectUri}&response_type=code&scope=${scope}&state=${state}`;
    }

    /**
     * 인증 코드로 액세스 토큰 획득
     */
    async getTokens(authCode) {
        try {
            const response = await axios.post('https://kauth.kakao.com/oauth/token', null, {
                params: {
                    grant_type: 'authorization_code',
                    client_id: this.REST_API_KEY,
                    redirect_uri: this.redirectUri,
                    code: authCode
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in
            };
        } catch (error) {
            console.error('토큰 발급 실패:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 리프레시 토큰으로 액세스 토큰 갱신
     */
    async refreshAccessToken(refreshToken) {
        try {
            const response = await axios.post('https://kauth.kakao.com/oauth/token', null, {
                params: {
                    grant_type: 'refresh_token',
                    client_id: this.REST_API_KEY,
                    refresh_token: refreshToken
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return {
                accessToken: response.data.access_token,
                expiresIn: response.data.expires_in
            };
        } catch (error) {
            console.error('토큰 갱신 실패:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 나에게 메시지 보내기 (테스트용)
     */
    async sendToMe(accessToken, message) {
        try {
            const template = {
                object_type: 'text',
                text: message,
                link: {
                    web_url: process.env.SERVICE_URL || 'http://localhost:3000',
                    mobile_web_url: process.env.SERVICE_URL || 'http://localhost:3000'
                },
                button_title: '자세히 보기'
            };

            const response = await axios.post(
                'https://kapi.kakao.com/v2/api/talk/memo/default/send',
                `template_object=${encodeURIComponent(JSON.stringify(template))}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('메시지 전송 실패:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 결제 요청 알림 메시지 생성
     */
    createPaymentRequestMessage(data) {
        const { requesterName, projectName, amount, category, description, accountInfo } = data;

        let message = `💳 결제 요청 알림\n\n`;
        message += `요청자: ${requesterName}\n`;
        message += `현장: ${projectName}\n`;
        message += `금액: ${this.formatAmount(amount)}원\n`;
        message += `구분: ${category}\n`;
        if (description) {
            message += `내용: ${description}\n`;
        }
        if (accountInfo) {
            message += `\n📌 계좌정보\n`;
            message += `${accountInfo.bank} ${accountInfo.accountNumber}\n`;
            message += `예금주: ${accountInfo.accountHolder}`;
        }

        return message;
    }

    /**
     * 결제 승인 알림 메시지 생성
     */
    createPaymentApprovalMessage(data) {
        const { requesterName, amount, approverName, approvalTime } = data;

        let message = `✅ 결제 승인 완료\n\n`;
        message += `${requesterName}님의 결제 요청이 승인되었습니다.\n\n`;
        message += `금액: ${this.formatAmount(amount)}원\n`;
        message += `승인자: ${approverName}\n`;
        message += `승인시간: ${this.formatDate(approvalTime)}\n\n`;
        message += `곧 입금 처리됩니다.`;

        return message;
    }

    /**
     * 결제 완료 알림 메시지 생성
     */
    createPaymentCompleteMessage(data) {
        const { requesterName, amount, completeTime } = data;

        let message = `💰 결제 완료\n\n`;
        message += `${requesterName}님께 요청하신 금액이 입금되었습니다.\n\n`;
        message += `입금액: ${this.formatAmount(amount)}원\n`;
        message += `처리시간: ${this.formatDate(completeTime)}\n\n`;
        message += `확인 부탁드립니다.`;

        return message;
    }

    /**
     * 금액 포맷팅 (천단위 콤마)
     */
    formatAmount(amount) {
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * 날짜 포맷팅
     */
    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day} ${hour}:${minute}`;
    }

    /**
     * 관리자들에게 메시지 발송
     * 실제 서비스에서는 각 관리자의 저장된 토큰을 사용
     */
    async notifyAdmins(message) {
        const results = [];

        for (const adminId of this.admins) {
            try {
                // 실제 서비스에서는 DB에서 관리자의 토큰을 조회
                const tokenData = this.tokenStore.get(adminId);
                if (!tokenData) {
                    console.log(`관리자 ${adminId}의 토큰이 없습니다. 인증이 필요합니다.`);
                    continue;
                }

                // 토큰 만료 확인 및 갱신
                if (Date.now() > tokenData.expiresAt) {
                    const newToken = await this.refreshAccessToken(tokenData.refreshToken);
                    tokenData.accessToken = newToken.accessToken;
                    tokenData.expiresAt = Date.now() + (newToken.expiresIn * 1000);
                    this.tokenStore.set(adminId, tokenData);
                }

                // 메시지 발송
                await this.sendToMe(tokenData.accessToken, message);
                results.push({ adminId, success: true });
            } catch (error) {
                console.error(`관리자 ${adminId}에게 메시지 발송 실패:`, error.message);
                results.push({ adminId, success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * 토큰 저장 (OAuth 콜백에서 호출)
     */
    saveToken(userId, tokenData) {
        this.tokenStore.set(userId, {
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            expiresAt: Date.now() + (tokenData.expiresIn * 1000)
        });
    }
}

module.exports = new KakaoMessageService();