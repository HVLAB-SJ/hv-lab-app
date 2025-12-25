import authFirestoreService from './firestore/authFirestoreService';

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
    const response = await authFirestoreService.login(credentials);
    if (response.success && response.token) {
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
  }

  async getCurrentUser(): Promise<User | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const user = await authFirestoreService.getCurrentUser(token);
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        return user;
      }
      // 토큰이 유효하지 않은 경우 (만료됨)
      console.log('Token invalid or expired, clearing...');
      this.logout();
      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      // 네트워크 에러 등의 경우 로컬 저장된 사용자 정보 반환
      const savedUser = this.getUser();
      if (savedUser) {
        console.log('Using cached user data due to error');
        return savedUser;
      }
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

  async getAllUsers(): Promise<User[]> {
    return authFirestoreService.getAllUsers();
  }
}

export default new AuthService();
