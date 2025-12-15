import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
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

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.user);
        // 인증 성공 시 스펙북 데이터 백그라운드에서 사전 로딩
        preloadSpecbook();
      }
    } catch {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);

      // 로그인 성공 시 스펙북 데이터 백그라운드에서 사전 로딩
      preloadSpecbook();

      toast.success(`${user.name}님, 환영합니다!`);

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