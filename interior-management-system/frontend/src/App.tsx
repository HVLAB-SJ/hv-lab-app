import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState, lazy, Suspense } from 'react';
import { io } from 'socket.io-client';
import { registerSW } from 'virtual:pwa-register';
import toast from 'react-hot-toast';
import Layout from './components/Layout';
import { AuthProvider } from './contexts/AuthContext';
import { triggerUrgentNotification, requestNotificationPermission } from './utils/notificationSound';
import socketService from './services/socket';

// 자주 사용하는 페이지는 직접 import (빠른 로딩)
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Schedule from './pages/Schedule';
import Payments from './pages/Payments';
import FinishCheck from './pages/FinishCheck';
import Contractors from './pages/Contractors';
import QuoteInquiry from './pages/QuoteInquiry';
import Login from './pages/Login';

// 나머지 페이지는 레이지 로딩 (코드 스플리팅)
const Drawings = lazy(() => import('./pages/Drawings'));
const SiteLog = lazy(() => import('./pages/SiteLog'));
const AfterService = lazy(() => import('./pages/AfterService'));
const AdditionalWork = lazy(() => import('./pages/AdditionalWork'));
const ConstructionPayment = lazy(() => import('./pages/ConstructionPayment'));
const WorkRequest = lazy(() => import('./pages/WorkRequest'));
const SpecBook = lazy(() => import('./pages/SpecBook'));
const EstimatePreview = lazy(() => import('./pages/EstimatePreview'));
const ExecutionHistory = lazy(() => import('./pages/ExecutionHistory'));

// 로딩 컴포넌트
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    // Service Worker 업데이트 감지 및 자동 적용
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // 새 버전이 감지되면
        console.log('🔄 새로운 버전이 감지되었습니다.');
        setNeedRefresh(true);

        // 자동으로 업데이트 적용
        toast.loading('새로운 버전을 적용하는 중...', { duration: 2000 });

        setTimeout(() => {
          updateSW(true).then(() => {
            toast.dismiss();
            toast.success('업데이트가 완료되었습니다!', {
              duration: 2000,
              icon: '🚀'
            });
            // 자동으로 페이지 새로고침
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          });
        }, 1500);
      },
      onOfflineReady() {
        console.log('📱 오프라인 사용 준비 완료');
      },
      onRegisteredSW(swUrl, r) {
        console.log('✅ Service Worker 등록:', swUrl);
        // 주기적으로 업데이트 확인 (1분마다)
        r && setInterval(() => {
          console.log('🔍 업데이트 확인 중...');
          r.update();
        }, 60000);
      },
      onRegisterError(error) {
        console.error('❌ Service Worker 등록 실패:', error);
      },
    });

    // Version 1.0.6 - Updated 2025.11.17 with auto-update
    // 브라우저 알림 권한 요청
    requestNotificationPermission();

    // 버전 체크 (5초 후 첫 체크, 이후 30초마다)
    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json?t=' + Date.now());
        const data = await response.json();
        const currentVersion = localStorage.getItem('app_version');

        if (currentVersion && currentVersion !== data.version) {
          console.log('🔄 새 버전 감지:', data.version);
          localStorage.setItem('app_version', data.version);

          // Service Worker 업데이트 트리거
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            registration.update();
          }
        } else if (!currentVersion) {
          localStorage.setItem('app_version', data.version);
        }
      } catch (error) {
        console.error('버전 체크 실패:', error);
      }
    };

    // 초기 실행 및 주기적 실행
    setTimeout(checkVersion, 5000); // 5초 후 첫 체크
    const versionInterval = setInterval(checkVersion, 30000); // 30초마다 체크

    // Socket.IO 연결 - 로컬 개발 환경에서만 사용
    // Cloud Functions는 WebSocket을 지원하지 않으므로 프로덕션에서는 비활성화
    const host = window.location.hostname;
    const isProduction = host === 'hvlab.app' || host.includes('hv-lab-app') || host.includes('firebaseapp.com');

    let socket: ReturnType<typeof io> | null = null;

    if (!isProduction) {
      // 로컬 개발 환경에서만 Socket.IO 연결
      const SOCKET_URL = window.location.origin;
      socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling']
      });

      // 전역 socketService에 소켓 인스턴스 설정 (다른 컴포넌트에서 사용 가능)
      socketService.setSocket(socket);

      socket.on('connect', () => {
        console.log('🔌 Socket.IO 연결됨');
      });

      // 긴급 결제 알림 수신
      socket.on('urgent-payment', (data: {
        project: string;
        amount: number;
        urgency: 'urgent' | 'emergency'
      }) => {
        console.log('🚨 긴급 결제 알림 수신:', data);

        const message = `${data.project} 프로젝트에서 ${data.amount.toLocaleString()}원 결제 요청`;
        triggerUrgentNotification(data.urgency, message);
      });

      socket.on('disconnect', () => {
        console.log('🔌 Socket.IO 연결 해제됨');
      });
    } else {
      console.log('📡 프로덕션 환경: Socket.IO 비활성화 (HTTP 폴링 사용)');
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
      clearInterval(versionInterval);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="projects" element={<Projects />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="drawings" element={<Drawings />} />
                <Route path="site-log" element={<SiteLog />} />
                <Route path="after-service" element={<AfterService />} />
                <Route path="additional-work" element={<AdditionalWork />} />
                <Route path="construction-payment" element={<ConstructionPayment />} />
                <Route path="contractors" element={<Contractors />} />
                <Route path="work-request" element={<WorkRequest />} />
                <Route path="finish-check" element={<FinishCheck />} />
                <Route path="specbook" element={<SpecBook />} />
                <Route path="estimate-preview" element={<EstimatePreview />} />
                <Route path="execution-history" element={<ExecutionHistory />} />
                <Route path="payments" element={<Payments />} />
                <Route path="quote-inquiry" element={<QuoteInquiry />} />
              </Route>
            </Routes>
          </Suspense>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#363636',
                border: '1px solid #e5e5e5',
              },
            }}
          />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;