import axios from 'axios';

interface KakaoMessageParams {
  purpose: string;
  amount: number;
  project: string;
  requestedBy: string;
  urgency: string;
}

class KakaoService {
  private readonly accessToken: string;
  private readonly adminKey: string;
  private readonly templateId: number;
  private readonly receiverUuids: string[];

  constructor() {
    this.accessToken = process.env.KAKAO_ACCESS_TOKEN || '';
    this.adminKey = process.env.KAKAO_ADMIN_KEY || '';
    this.templateId = parseInt(process.env.KAKAO_TEMPLATE_ID || '0');
    this.receiverUuids = (process.env.KAKAO_RECEIVER_UUIDS || '').split(',');
  }

  async sendPaymentNotification(params: KakaoMessageParams): Promise<void> {
    if (!this.accessToken) {
      console.warn('Kakao access token is not configured. Skipping notification...');
      return;
    }

    try {
      // 카카오톡 메시지 전송 (나에게 보내기)
      const templateObject = {
        object_type: 'text',
        text: this.formatMessage(params),
        link: {
          web_url: process.env.FRONTEND_URL || 'http://localhost:5173',
          mobile_web_url: process.env.FRONTEND_URL || 'http://localhost:5173'
        },
        button_title: '결제 확인하기'
      };

      const response = await axios.post(
        'https://kapi.kakao.com/v2/api/talk/memo/default/send',
        new URLSearchParams({
          template_object: JSON.stringify(templateObject)
        }),
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
          }
        }
      );

      console.log('Kakao notification sent successfully:', response.data);
    } catch (error: any) {
      console.error('Failed to send Kakao notification:', error.response?.data || error.message);
      // 알림 실패해도 결제 요청은 계속 진행
    }
  }

  private formatMessage(params: KakaoMessageParams): string {
    const urgencyLabel = params.urgency === 'urgent' ? '🔴 긴급' : params.urgency === 'emergency' ? '🚨 매우긴급' : '⚪ 보통';

    return `
${urgencyLabel} 결제 요청이 등록되었습니다

📋 용도: ${params.purpose}
💰 금액: ₩${params.amount.toLocaleString()}
🏢 프로젝트: ${params.project}
👤 요청자: ${params.requestedBy}

결제 승인이 필요합니다.
    `.trim();
  }
}

export default new KakaoService();
