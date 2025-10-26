/**
 * 긴급 알림음 재생 유틸리티
 */

// Web Audio API를 사용한 비프음 생성
export const playUrgentNotification = (urgency: 'urgent' | 'emergency') => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();

    // 긴급도에 따라 반복 횟수 설정
    const repeatCount = urgency === 'emergency' ? 5 : 3;
    let currentRepeat = 0;

    const playBeep = () => {
      if (currentRepeat >= repeatCount) {
        return;
      }

      // 오실레이터 생성 (비프음)
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // 주파수 설정 (긴급: 800Hz, 매우긴급: 1000Hz)
      oscillator.frequency.value = urgency === 'emergency' ? 1000 : 800;
      oscillator.type = 'sine';

      // 볼륨 설정
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      // 재생
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      currentRepeat++;

      // 다음 비프음 예약 (0.7초 간격)
      if (currentRepeat < repeatCount) {
        setTimeout(playBeep, 700);
      }
    };

    playBeep();
  } catch (error) {
    console.error('알림음 재생 실패:', error);
  }
};

// 진동 알림 (모바일용)
export const vibrateDevice = (urgency: 'urgent' | 'emergency') => {
  if ('vibrate' in navigator) {
    // 긴급: 짧게 3번, 매우긴급: 길게 5번
    const pattern = urgency === 'emergency'
      ? [200, 200, 200, 200, 200, 200, 200, 200, 200, 200] // 5번
      : [200, 200, 200, 200, 200, 200]; // 3번

    navigator.vibrate(pattern);
  }
};

// 통합 알림 함수
export const triggerUrgentNotification = (urgency: 'urgent' | 'emergency', message: string) => {
  // 알림음 재생
  playUrgentNotification(urgency);

  // 진동 (모바일)
  vibrateDevice(urgency);

  // 브라우저 알림 권한이 있으면 표시
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('긴급 결제 요청', {
      body: message,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'urgent-payment',
      requireInteraction: true // 사용자가 닫을 때까지 유지
    });
  }
};

// 브라우저 알림 권한 요청
export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
};
