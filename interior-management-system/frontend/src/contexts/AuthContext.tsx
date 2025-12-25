import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
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
      // 먼저 로컬에 저장된 사용자 정보 확인
      const savedUserStr = localStorage.getItem('user');
      let savedUser: User | null = null;

      if (savedUserStr) {
        try {
          savedUser = JSON.parse(savedUserStr);
        } catch {
          // 파싱 실패 시 무시
        }
      }

      // 로컬에 사용자 정보가 있으면 즉시 로그인 상태로 설정 (빠른 UI 응답)
      if (savedUser) {
        setUser(savedUser);
        // 스펙북 데이터 백그라운드에서 사전 로딩
        preloadSpecbook();
      }

      const token = localStorage.getItem('token');
      if (!token) {
        // 토큰이 없어도 저장된 사용자 정보가 있으면 로그인 상태 유지
        setLoading(false);
        return;
      }

      // Firestore를 통한 인증 확인 (백그라운드)
      const user = await authService.getCurrentUser();
      if (user) {
        setUser(user);
        localStorage.setItem('user', JSON.stringify(user)); // 최신 정보로 갱신
      }
      // user가 null이어도 savedUser가 있으면 로그아웃하지 않음
    } catch (error: unknown) {
      // 에러 발생해도 로컬에 저장된 사용자 정보가 있으면 유지
      console.error('Auth check error:', error);
      // 이미 위에서 savedUser로 setUser를 했으므로 추가 처리 불필요
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      // Firestore를 통한 로그인
      const response = await authService.login({ username, password });
      const token = response.token;
      const loggedInUser = response.user as User;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(loggedInUser));  // 유저 정보도 저장
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
