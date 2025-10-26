import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import NotificationPanel from './NotificationPanel';
import { useNotificationStore } from '../store/notificationStore';
import workRequestService from '../services/workRequestService';

interface NavigationItem {
  name: string;
  href: string;
  roles?: string[];
  badge?: number;
}

const Layout = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const location = useLocation();
  const { unreadCount } = useNotificationStore();
  const [pendingWorkRequestCount, setPendingWorkRequestCount] = useState(0);

  const navigation: NavigationItem[] = [
    { name: '담당업무', href: '/dashboard' },
    { name: '프로젝트', href: '/projects' },
    { name: '일정관리', href: '/schedule' },
    { name: 'AS 관리', href: '/after-service' },
    { name: '추가내역', href: '/additional-work' },
    { name: '공사대금', href: '/construction-payment', roles: ['admin', 'manager'] },
    { name: '협력업체', href: '/contractors' },
    { name: '업무요청', href: '/work-request', badge: pendingWorkRequestCount },
    { name: '실행내역', href: '/execution-history' },
    { name: '결제요청', href: '/payments' },
  ];

  // Load pending work requests count for current user
  useEffect(() => {
    const loadPendingWorkRequests = async () => {
      if (!user) return;

      try {
        const workRequests = await workRequestService.getAllWorkRequests();
        // Count work requests that are assigned to current user and have 'pending' status
        const pendingCount = workRequests.filter(
          req => req.assignedTo === user.name && req.status === 'pending'
        ).length;
        setPendingWorkRequestCount(pendingCount);
      } catch (error) {
        console.error('Failed to load pending work requests:', error);
      }
    };

    loadPendingWorkRequests();
    // Refresh every 30 seconds
    const interval = setInterval(loadPendingWorkRequests, 30000);
    return () => clearInterval(interval);
  }, [user]);

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
      '/work-request',
      '/payments'
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
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
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
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            {/* Left side - Mobile: menu button + title, Desktop: empty spacer */}
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
                <h1 className="text-lg font-bold text-gray-900 lg:hidden">{currentPageTitle}</h1>
              )}
              {/* Desktop: empty spacer to push right side icons to consistent position */}
              <div className="hidden lg:block w-0"></div>
            </div>

            {/* Right side - Always aligned to the right */}
            <div className="flex items-center space-x-2 sm:space-x-6 ml-auto">
              {/* Show + button if page has add action (mobile only) */}
              {pageAction && (
                <button
                  onClick={pageAction}
                  className="lg:hidden p-2 text-gray-900 hover:text-gray-700"
                  aria-label="추가"
                >
                  <Plus className="h-6 w-6" />
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

        {/* Page content */}
        <main className="py-[10px] md:py-6 lg:py-8">
          <div className="px-3 sm:px-4 md:px-6 lg:px-8">
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