import axios from 'axios';

// 호스트에 따라 API URL 결정
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
const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 에러 처리는 AuthContext의 checkAuth에서 담당
    // 여기서는 /auth/me 요청이 아닌 경우에만 로그인 페이지로 리다이렉트
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/me')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;