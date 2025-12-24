import axios from 'axios';
import authFirestoreService from './firestore/authFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

// 호스트에 따라 API URL 결정
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Firebase Hosting (hvlab.app, hv-lab-app.web.app, hv-lab-app.firebaseapp.com)
    if (host === 'hvlab.app' || host.includes('hv-lab-app') || host.includes('firebaseapp.com')) {
      return 'https://api.hvlab.app/api';
    }
  }
  // 로컬 개발
  return '/api';
};
const API_URL = getApiUrl();

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: string;
  phone?: string;
  department?: string;
  position?: string;
  avatar?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    // Firestore 사용 시
    if (getDataSourceConfig()) {
      console.log('[authService] Using Firestore');
      const response = await authFirestoreService.login(credentials);
      if (response.success && response.token) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
      }
      return response;
    }

    // Railway API 사용 시
    console.log('[authService] Using Railway API');
    const response = await axios.post(`${API_URL}/auth/login`, credentials);
    if (response.data.success && response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  }

  async getCurrentUser(): Promise<User | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      // Firestore 사용 시
      if (getDataSourceConfig()) {
        const user = await authFirestoreService.getCurrentUser(token);
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
        }
        return user;
      }

      // Railway API 사용 시
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.data.success) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        return response.data.user;
      }
      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      this.logout();
      return null;
    }
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Firestore 전용: 모든 사용자 조회
  async getAllUsers(): Promise<User[]> {
    if (getDataSourceConfig()) {
      return authFirestoreService.getAllUsers();
    }
    // Railway API fallback - 구현 필요시 추가
    return [];
  }
}

export default new AuthService();
