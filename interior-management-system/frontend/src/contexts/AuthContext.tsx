import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import authService from '../services/authService';
import { getDataSourceConfig } from '../services/firestore/dataSourceConfig';
import toast from 'react-hot-toast';
import type { ApiError } from '../types/forms';
import { useSpecbookStore } from '../store/specbookStore';

interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: 'admin' | 'manager' | 'fieldManager' | 'worker';
  phone?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 스펙북 사전 로딩 함수
  const preloadSpecbook = useSpecbookStore(state => state.preloadAll);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Firestore 사용 시 authService 사용
      if (getDataSourceConfig()) {
        console.log('[AuthContext] Using Firestore via authService');
        const user = await authService.getCurrentUser();
        if (user) {
          setUser(user);
          // 인증 성공 시 스펙북 데이터 백그라운드에서 사전 로딩
          preloadSpecbook();
        }
      } else {
        // Railway API 사용 시 기존 방식
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await api.get('/auth/me');
        if (response.data.success) {
          setUser(response.data.user);
          // 인증 성공 시 스펙북 데이터 백그라운드에서 사전 로딩
          preloadSpecbook();
        }
      }
    } catch (error: unknown) {
      // 401 에러인 경우에만 토큰 삭제 (토큰이 만료되었거나 유효하지 않음)
      // 네트워크 에러나 서버 에러는 토큰을 유지하여 재시도 가능하게 함
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 401) {
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
      } else {
        // 네트워크 에러 등의 경우 토큰은 유지하고, 로컬스토리지에서 유저 정보 복원 시도
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            // 파싱 실패 시 무시
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      let token: string;
      let loggedInUser: User;

      // Firestore 사용 시 authService 사용
      if (getDataSourceConfig()) {
        console.log('[AuthContext] Login via authService (Firestore)');
        const response = await authService.login({ username, password });
        token = response.token;
        loggedInUser = response.user as User;
      } else {
        // Railway API 사용 시 기존 방식
        const response = await api.post('/auth/login', { username, password });
        token = response.data.token;
        loggedInUser = response.data.user;
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(loggedInUser));  // 유저 정보도 저장
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(loggedInUser);

      // 로그인 성공 시 스펙북 데이터 백그라운드에서 사전 로딩
      preloadSpecbook();

      toast.success(`${loggedInUser.name}님, 환영합니다!`);

      // 저장된 리다이렉트 URL이 있으면 해당 URL로 이동
      const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
      if (redirectUrl) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectUrl);
      } else {
        navigate('/');
      }
    } catch (error) {
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.message || '로그인 실패');
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');  // 유저 정보도 삭제
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    navigate('/login');
    toast.success('로그아웃되었습니다');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}