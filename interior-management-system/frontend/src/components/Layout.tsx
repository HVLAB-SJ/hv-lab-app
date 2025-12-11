import { Outlet, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import { Plus, X, BookOpen, RefreshCw } from 'lucide-react';
import NotificationPanel from './NotificationPanel';
import { useNotificationStore } from '../store/notificationStore';
import workRequestService from '../services/workRequestService';
import paymentService from '../services/paymentService';
import asRequestService from '../services/asRequestService';
import projectService from '../services/projectService';
import api from '../services/api';
import socketService from '../services/socket';

interface NavigationItem {
  name: string;
  href: string;
  roles?: string[];
  badge?: number;
}

const Layout = () => {
  const { user, logout, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const location = useLocation();
  const { unreadCount } = useNotificationStore();
  const [pendingWorkRequestCount, setPendingWorkRequestCount] = useState(0);
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [inProgressASCount, setInProgressASCount] = useState(0);
  const [unreadQuoteInquiryCount, setUnreadQuoteInquiryCount] = useState(0);

  // Pull-to-refresh 상태
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 80; // 새로고침 트리거 거리

  // 스크롤 가능한 모든 부모 요소가 최상단인지 확인
  const isAllScrollableAtTop = useCallback((element: HTMLElement | null): boolean => {
    // window 스크롤 체크
    if (window.scrollY > 0) return false;

    // 터치 시작 요소부터 상위로 올라가며 스크롤 가능한 요소 체크
    let current = element;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;

      // 스크롤 가능한 요소인지 확인
      if (overflowY === 'auto' || overflowY === 'scroll') {
        // 스크롤이 최상단이 아니면 false
        if (current.scrollTop > 0) {
          return false;
        }
      }
      current = current.parentElement;
    }
    return true;
  }, []);

  // Pull-to-refresh 핸들러
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // 모바일에서만 동작
    if (window.innerWidth >= 768) return;

    // 터치 시작 요소부터 모든 스크롤 가능한 부모가 최상단인지 확인
    const touchTarget = e.target as HTMLElement;
    if (isAllScrollableAtTop(touchTarget)) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, [isAllScrollableAtTop]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    // 스크롤 위치 재확인
    const touchTarget = e.target as HTMLElement;
    if (!isAllScrollableAtTop(touchTarget)) {
      setIsPulling(false);
      setPullDistance(0);
      return;
    }

    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY.current;

    // 아래로 당길 때만 (양수 값)
    if (diff > 0) {
      // 저항 효과 적용 (당길수록 덜 움직임)
      const distance = Math.min(diff * 0.5, 120);
      setPullDistance(distance);
    } else {
      // 위로 스크롤하려는 경우 pull-to-refresh 취소
      setIsPulling(false);
      setPullDistance(0);
    }
  }, [isPulling, isRefreshing, isAllScrollableAtTop]);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling) return;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      // 새로고침 실행
      setIsRefreshing(true);
      setPullDistance(50); // 로딩 표시용 고정 거리

      // 페이지 새로고침
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } else {
      // 원위치
      setPullDistance(0);
    }
    setIsPulling(false);
  }, [isPulling, pullDistance, isRefreshing]);

  // 페이지 변경 시 모바일 폼 상태 초기화
  useEffect(() => {
    setMobileFormOpen(false);
  }, [location.pathname]);

  // 모바일 폼 상태 변경 이벤트 리스너
  useEffect(() => {
    const handleFormStateChange = (e: CustomEvent<{ isOpen: boolean }>) => {
      setMobileFormOpen(e.detail.isOpen);
    };

    window.addEventListener('mobileFormStateChange', handleFormStateChange as EventListener);
    return () => window.removeEventListener('mobileFormStateChange', handleFormStateChange as EventListener);
  }, []);

  // 견적문의 읽음 처리 시 배지 즉시 업데이트
  useEffect(() => {
    const handleQuoteInquiryRead = () => {
      setUnreadQuoteInquiryCount(prev => Math.max(0, prev - 1));
    };

    window.addEventListener('quoteInquiryRead', handleQuoteInquiryRead);
    return () => window.removeEventListener('quoteInquiryRead', handleQuoteInquiryRead);
  }, []);

  // 결제요청 송금완료 처리 시 배지 즉시 업데이트
  useEffect(() => {
    const handlePaymentCompleted = () => {
      setPendingPaymentCount(prev => Math.max(0, prev - 1));
    };

    window.addEventListener('paymentCompleted', handlePaymentCompleted);
    return () => window.removeEventListener('paymentCompleted', handlePaymentCompleted);
  }, []);

  // Socket.IO 실시간 동기화 - 결제 상태 변경 시 배지 업데이트
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !user) return;

    const handlePaymentRefresh = async () => {
      // 결제요청 pending 카운트 다시 로드
      try {
        const [payments, projects] = await Promise.all([
          paymentService.getAllPayments(),
          projectService.getAllProjects()
        ]);

        // 안팀 사용자는 담당 프로젝트의 결제요청만 카운트
        let filteredPayments = payments;
        if (user.name === '안팀') {
          const projectNames = projects.map(p => p.name);
          filteredPayments = payments.filter(p => projectNames.includes(p.project));
        }
        setPendingPaymentCount(
          filteredPayments.filter(payment => payment.status === 'pending').length
        );
      } catch (error) {
        console.error('Failed to refresh payment count:', error);
      }
    };

    socket.on('payment:refresh', handlePaymentRefresh);

    return () => {
      socket.off('payment:refresh', handlePaymentRefresh);
    };
  }, [user]);

  // Load all badge counts in a single effect (optimized)
  useEffect(() => {
    if (!user) return;

    const loadAllBadgeCounts = async () => {
      try {
        const [workRequests, payments, asRequests, projects] = await Promise.all([
          workRequestService.getAllWorkRequests(),
          paymentService.getAllPayments(),
          asRequestService.getAllASRequests(),
          projectService.getAllProjects()
        ]);

        setPendingWorkRequestCount(
          workRequests.filter(req => req.assignedTo === user.name && req.status === 'pending').length
        );

        // 안팀 사용자는 담당 프로젝트의 결제요청만 카운트
        let filteredPayments = payments;
        if (user.name === '안팀') {
          const projectNames = projects.map(p => p.name);
          filteredPayments = payments.filter(p => projectNames.includes(p.project));
        }
        setPendingPaymentCount(
          filteredPayments.filter(payment => payment.status === 'pending').length
        );
        setInProgressASCount(
          asRequests.filter(req => req.status === 'in-progress').length
        );

        // 견적문의 읽지 않은 수 조회 (관리자/매니저만)
        if (user.role === 'admin' || user.role === 'manager') {
          try {
            const quoteResponse = await api.get('/quote-inquiries');
            const unreadQuotes = quoteResponse.data.filter((inq: { isRead: boolean }) => !inq.isRead).length;
            setUnreadQuoteInquiryCount(unreadQuotes);
          } catch (quoteError) {
            console.error('Failed to load quote inquiry count:', quoteError);
          }
        }
      } catch (error) {
        console.error('Failed to load badge counts:', error);
      }
    };

    loadAllBadgeCounts();
    const interval = setInterval(loadAllBadgeCounts, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // 인증 확인 중일 때 로딩 표시
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const navigation: NavigationItem[] = [
    { name: '담당업무', href: '/dashboard' },
    { name: '프로젝트', href: '/projects' },
    { name: '일정표', href: '/schedule' },
    { name: '공사도면', href: '/drawings' },
    { name: '현장일지', href: '/site-log' },
    { name: '추가내역', href: '/additional-work' },
    { name: '공사대금', href: '/construction-payment', roles: ['admin', 'manager'] },
    { name: '업무요청', href: '/work-request', ...(pendingWorkRequestCount > 0 && { badge: pendingWorkRequestCount }) },
    { name: '스펙북', href: '/specbook' },
    { name: '마감체크', href: '/finish-check' },
    { name: '실행내역', href: '/execution-history' },
    { name: '결제요청', href: '/payments', ...(pendingPaymentCount > 0 && { badge: pendingPaymentCount }) },
    { name: 'AS 관리', href: '/after-service', ...(inProgressASCount > 0 && { badge: inProgressASCount }) },
    { name: '가견적서', href: '/estimate-preview', roles: ['admin', 'manager'] },
    { name: '견적문의', href: '/quote-inquiry', roles: ['admin', 'manager'], ...(unreadQuoteInquiryCount > 0 && { badge: unreadQuoteInquiryCount }) },
    { name: '협력업체', href: '/contractors' },
  ];

  // 사용자 권한에 따라 메뉴 필터링
  const filteredNavigation = navigation.filter(item =>
    !item.roles || item.roles.includes(user?.role || '')
  );

  // 현재 페이지 제목 가져오기
  const currentPageTitle = navigation.find(item => item.href === location.pathname)?.name || '';

  // 페이지별 추가 버튼 액션 정의
  const getPageAction = () => {
    const path = location.pathname;

    // 해당 페이지에서만 + 버튼 표시
    const pagesWithAddButton = [
      '/projects',
      '/schedule',
      '/after-service',
      '/additional-work',
      '/construction-payment',
      '/contractors',
      '/work-request'
    ];

    if (!pagesWithAddButton.includes(path)) {
      return null;
    }

    return () => {
      // 각 페이지의 버튼 클릭 이벤트를 트리거
      const event = new CustomEvent('headerAddButtonClick');
      window.dispatchEvent(event);
    };
  };

  const pageAction = getPageAction();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div
        className={clsx(
          'fixed inset-0 z-40 lg:hidden',
          sidebarOpen ? 'block' : 'hidden'
        )}
      >
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">HV LAB</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ✕
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-4 py-4">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'block px-4 py-3 text-sm font-medium border-l-2 transition-colors relative',
                    isActive
                      ? 'border-gray-900 bg-gray-50 text-gray-900'
                      : 'border-transparent text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                  )
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="flex items-center justify-between">
                  <span>{item.name}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-gray-200 px-4 py-4">
            <button
              onClick={logout}
              className="w-full px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 text-left"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="desktop-sidebar hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">HV LAB</h2>
          </div>
          <nav className="flex-1 space-y-1 px-4 py-4">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'block px-4 py-3 text-sm font-medium border-l-2 transition-colors relative',
                    isActive
                      ? 'border-gray-900 bg-gray-50 text-gray-900'
                      : 'border-transparent text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                  )
                }
              >
                <span className="flex items-center justify-between">
                  <span>{item.name}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-gray-200 px-4 py-4">
            <button
              onClick={logout}
              className="w-full px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 text-left"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 print-hide">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            {/* Left side - Mobile: menu button + title, Desktop: page title */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 -ml-2"
                aria-label="메뉴 열기"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {currentPageTitle && (
                <h1 className="text-lg font-bold text-gray-900">{currentPageTitle}</h1>
              )}
            </div>

            {/* Right side - Always aligned to the right */}
            <div className="flex items-center space-x-2 sm:space-x-6 ml-auto">
              {/* Show + or X button if page has add action (mobile only) */}
              {pageAction && (
                <button
                  onClick={pageAction}
                  className="lg:hidden p-2 text-gray-900 hover:text-gray-700"
                  aria-label={mobileFormOpen ? "닫기" : "추가"}
                >
                  {mobileFormOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                </button>
              )}

              <button
                onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
                className="hidden sm:block relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="알림"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center h-4 w-4 bg-red-600 text-white text-[10px] font-bold rounded-full">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <div className="hidden sm:flex items-center space-x-2 sm:space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.role}</p>
                </div>
                <div className="h-8 w-8 sm:h-9 sm:w-9 bg-gray-900 text-white flex items-center justify-center text-xs font-bold rounded-full">
                  {user?.name?.substring(0, 1)}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Portrait mode top navigation */}
        <div className="portrait-top-nav hidden">
          <div className="flex items-center gap-1 px-2 py-2 bg-white border-b border-gray-200 overflow-x-auto">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors relative',
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  )
                }
              >
                <span className="flex items-center gap-1">
                  <span>{item.name}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* Page content */}
        <main
          ref={mainRef}
          className="py-[10px] md:py-6 lg:py-8"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Pull-to-refresh indicator (모바일 전용) */}
          {pullDistance > 0 && (
            <div
              className="md:hidden fixed left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
              style={{
                top: 56, // 헤더 높이
                height: pullDistance,
                transition: isPulling ? 'none' : 'height 0.2s ease-out'
              }}
            >
              <div
                className={clsx(
                  "flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-lg border",
                  isRefreshing && "animate-spin"
                )}
                style={{
                  transform: `rotate(${isRefreshing ? 0 : pullDistance * 2}deg)`,
                  opacity: Math.min(pullDistance / PULL_THRESHOLD, 1)
                }}
              >
                <RefreshCw
                  className={clsx(
                    "w-5 h-5",
                    pullDistance >= PULL_THRESHOLD ? "text-blue-600" : "text-gray-400"
                  )}
                />
              </div>
            </div>
          )}

          <div
            className="px-3 sm:px-4 md:px-6 lg:px-8"
            style={{
              transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none',
              transition: isPulling ? 'none' : 'transform 0.2s ease-out'
            }}
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={notificationPanelOpen}
        onClose={() => setNotificationPanelOpen(false)}
      />
    </div>
  );
};

export default Layout;