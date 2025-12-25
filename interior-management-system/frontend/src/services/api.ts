import axios from 'axios';

/**
 * Firebase Cloud Functions API 클라이언트
 * SMS 발송 등 Cloud Functions 엔드포인트 호출에만 사용
 */

// Firebase Cloud Functions URL
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Firebase Hosting (hvlab.app, hv-lab-app.web.app, hv-lab-app.firebaseapp.com)
    if (host === 'hvlab.app' || host.includes('hv-lab-app') || host.includes('firebaseapp.com')) {
      return 'https://asia-northeast3-hv-lab-app.cloudfunctions.net/api';
    }
  }
  // 로컬 개발
  return '/api';
};

const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
