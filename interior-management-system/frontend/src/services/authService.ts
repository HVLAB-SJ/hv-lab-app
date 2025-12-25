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

    // 토큰이 없어도 로컬에 저장된 사용자 정보가 있으면 반환
    const savedUser = this.getUser();

    if (!token) {
      return savedUser;
    }

    try {
      const user = await authFirestoreService.getCurrentUser(token);
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        return user;
      }
      // 토큰이 유효하지 않은 경우 - 로컬 사용자 정보 유지 (로그아웃 안 함)
      console.log('Token invalid or expired, using cached user...');
      if (savedUser) {
        // 토큰만 제거하고 사용자 정보는 유지
        localStorage.removeItem('token');
        return savedUser;
      }
      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      // 네트워크 에러 등의 경우 로컬 저장된 사용자 정보 반환
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
