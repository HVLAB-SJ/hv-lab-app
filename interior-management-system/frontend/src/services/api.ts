import axios from 'axios';

// 호스트에 따라 API URL 결정
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Firebase Hosting (hv-lab-app.web.app 또는 hv-lab-app.firebaseapp.com)
    if (host.includes('hv-lab-app') || host.includes('firebaseapp.com')) {
      return 'https://hvlab.app/api';
    }
  }
  // Railway 또는 로컬 개발
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
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;