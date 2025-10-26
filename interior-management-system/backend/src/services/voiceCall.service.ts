/**
 * 긴급 음성 통화 알림 서비스 (CoolSMS)
 */

import axios from 'axios';
import CryptoJS from 'crypto-js';
import { config } from '../config/env.config';

/**
 * 긴급 결제 요청 시 SMS 발송
 */
export const sendUrgentVoiceCall = async (params: {
  phoneNumber: string;
  amount: number;
  project: string;
  urgency: 'urgent' | 'emergency';
}): Promise<void> => {
  console.log('🔔 sendUrgentVoiceCall 호출됨:', params);

  const apiKey = config.coolsms.apiKey;
  const apiSecret = config.coolsms.apiSecret;
  const fromNumber = config.coolsms.fromNumber;

  console.log('📝 CoolSMS 설정 확인:', {
    apiKey: apiKey ? '설정됨' : '없음',
    apiSecret: apiSecret ? '설정됨' : '없음',
    fromNumber: fromNumber ? fromNumber : '없음'
  });

  if (!apiKey || !apiSecret || !fromNumber) {
    console.warn('⚠️ CoolSMS 환경 변수가 설정되지 않았습니다');
    return;
  }

  // 긴급도에 따른 메시지 작성
  const urgencyText = params.urgency === 'emergency' ? '매우 긴급' : '긴급';
  const message = `[${urgencyText}] ${params.project} 프로젝트에서 ${params.amount.toLocaleString()}원 결제 요청이 있습니다.`;

  console.log('📱 발송할 메시지:', message);

  try {
    // CoolSMS API v4 사용
    const date = new Date().toISOString();
    const salt = Math.random().toString(36).substring(2);
    const signature = CryptoJS.HmacSHA256(date + salt, apiSecret).toString();

    console.log('🔑 인증 정보 생성 완료');

    // 음성 통화 옵션 설정
    const voiceOptions = {
      voiceType: 'FEMALE' as const,  // 여성 목소리
      headerMessage: params.urgency === 'emergency' ? '매우 긴급한 결제 요청입니다.' : '긴급 결제 요청입니다.'
    };

    console.log('📞 음성 통화 발송 시작');

    const response = await axios.post(
      'https://api.coolsms.co.kr/messages/v4/send',
      {
        message: {
          to: params.phoneNumber,
          from: fromNumber,
          text: message,
          type: 'VOICE',  // 음성 통화
          voiceOptions: voiceOptions
        }
      },
      {
        headers: {
          'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ 음성 통화 발송 성공:', params.phoneNumber, response.data);
  } catch (error: any) {
    console.error('❌ 음성 통화 발송 실패:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * SMS 문자 메시지 발송
 */
export const sendUrgentSMS = async (params: {
  phoneNumber: string;
  amount: number;
  project: string;
  urgency: 'urgent' | 'emergency';
  process?: string;
  itemName?: string;
  bankInfo?: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
  };
}): Promise<void> => {
  const apiKey = config.coolsms.apiKey;
  const apiSecret = config.coolsms.apiSecret;
  const fromNumber = config.coolsms.fromNumber;

  if (!apiKey || !apiSecret || !fromNumber) {
    console.warn('CoolSMS 환경 변수가 설정되지 않았습니다');
    return;
  }

  // 새로운 메시지 형식
  const urgencyPrefix = params.urgency === 'emergency' ? '🚨' : params.urgency === 'urgent' ? '⚡' : '';
  const content = params.itemName || params.process || '결제요청';
  const bankInfoText = params.bankInfo
    ? `${params.bankInfo.bankName} ${params.bankInfo.accountNumber} ${params.bankInfo.accountHolder}`
    : '계좌정보 미입력';

  const message = `${urgencyPrefix}[${params.project}]
${content}
${bankInfoText}
${params.amount.toLocaleString()}원`;

  try {
    // CoolSMS API v4 사용
    const date = new Date().toISOString();
    const salt = Math.random().toString(36).substring(2);
    const signature = CryptoJS.HmacSHA256(date + salt, apiSecret).toString();

    const response = await axios.post(
      'https://api.coolsms.co.kr/messages/v4/send',
      {
        message: {
          to: params.phoneNumber,
          from: fromNumber,
          text: message,
          type: 'SMS'  // SMS (90 bytes 이내)
        }
      },
      {
        headers: {
          'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('긴급 SMS 발송 성공:', params.phoneNumber, response.data);
  } catch (error: any) {
    console.error('CoolSMS 발송 실패:', error.response?.data || error.message);
    throw error;
  }
};
