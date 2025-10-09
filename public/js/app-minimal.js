// ==========================================
// 미니멀 버전 - 메인 앱
// ==========================================

let currentUser = null;
let authToken = null;
let socket = null;
let projects = [];
let schedules = [];
let currentView = 'dashboard';

const API_URL = 'http://localhost:3000/api';

// ==========================================
// 초기화
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        authToken = savedToken;
        verifyToken();
    }

    setupEventListeners();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    // 로그인
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);

    // 로그아웃
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    // 네비게이션
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view) switchView(view);
        });
    });

    // 새로고침
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadCurrentView();
    });

    // 추가 버튼
    document.getElementById('addNewBtn')?.addEventListener('click', () => {
        if (currentView === 'payments') {
            showPaymentModal();
        } else if (currentView === 'projects') {
            openModal('projectModal');
        } else if (currentView === 'schedules') {
            openModal('scheduleModal');
        }
    });
}

// ==========================================
// 인증
// ==========================================
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);

            showMainApp();
            initSocketConnection();
            await loadInitialData();
        } else {
            alert(data.error || '로그인 실패');
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        alert('서버 연결 실패');
    }
}

async function verifyToken() {
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (response.ok && data.valid) {
            currentUser = data.user;
            showMainApp();
            initSocketConnection();
            await loadInitialData();
        } else {
            localStorage.removeItem('authToken');
            authToken = null;
        }
    } catch (error) {
        console.error('토큰 검증 오류:', error);
        localStorage.removeItem('authToken');
        authToken = null;
    }
}

function handleLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        localStorage.removeItem('authToken');
        authToken = null;
        currentUser = null;

        if (socket) {
            socket.disconnect();
        }

        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
}

// ==========================================
// UI 전환
// ==========================================
function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';

    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userRole').textContent =
            currentUser.role === 'admin' ? '관리자' :
            currentUser.role === 'manager' ? '매니저' : '작업자';
    }
}

function switchView(viewName) {
    // 뷰 전환
    document.querySelectorAll('.view-content').forEach(view => {
        view.classList.remove('active');
        view.style.display = 'none';
    });

    // 네비게이션 활성화
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // 선택된 뷰 표시
    const selectedView = document.getElementById(`${viewName}View`);
    if (selectedView) {
        selectedView.classList.add('active');
        selectedView.style.display = 'block';
    }

    // 네비게이션 활성화
    const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // 페이지 제목 변경
    const titles = {
        'dashboard': '대시보드',
        'payments': '결제 요청',
        'projects': '현장 관리',
        'schedules': '일정 관리',
        'team': '팀원 관리'
    };
    document.getElementById('pageTitle').textContent = titles[viewName] || viewName;

    // 추가 버튼 텍스트 변경
    const addBtn = document.getElementById('addNewBtn');
    if (addBtn) {
        const btnTexts = {
            'payments': '결제 요청',
            'projects': '현장 추가',
            'schedules': '일정 추가',
            'team': '팀원 추가'
        };
        addBtn.textContent = btnTexts[viewName] || '추가';
        addBtn.style.display = viewName === 'dashboard' ? 'none' : 'inline-flex';
    }

    currentView = viewName;
    loadCurrentView();
}

function loadCurrentView() {
    switch(currentView) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'payments':
            loadPayments();
            break;
        case 'projects':
            loadProjects();
            break;
        case 'schedules':
            loadSchedules();
            break;
        case 'team':
            loadTeam();
            break;
    }
}

// ==========================================
// Socket.IO
// ==========================================
function initSocketConnection() {
    socket = io();

    socket.on('connect', () => {
        console.log('Socket.IO 연결됨');
    });

    socket.on('payment-request', (data) => {
        console.log('새 결제 요청:', data);
        if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
            showNotification('새로운 결제 요청이 있습니다.');
            if (currentView === 'payments' || currentView === 'dashboard') {
                loadPayments();
            }
        }
    });

    socket.on('payment-approved', (data) => {
        console.log('결제 승인:', data);
        showNotification('결제 요청이 승인되었습니다.');
        loadPayments();
    });
}

// ==========================================
// 데이터 로드
// ==========================================
async function loadInitialData() {
    try {
        await Promise.all([
            loadProjects(),
            loadSchedules(),
            loadPayments(),
            loadDashboard()
        ]);
    } catch (error) {
        console.error('초기 데이터 로드 오류:', error);
    }
}

async function loadDashboard() {
    try {
        // 프로젝트 통계
        const projectsResponse = await fetch(`${API_URL}/projects`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const projectsData = await projectsResponse.json();

        // 일정 통계
        const schedulesResponse = await fetch(`${API_URL}/schedules`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const schedulesData = await schedulesResponse.json();

        // 통계 업데이트
        const activeProjects = projectsData.filter(p =>
            p.status === 'in_progress' || p.status === 'active'
        ).length;

        const today = new Date().toISOString().split('T')[0];
        const todaySchedules = schedulesData.filter(s => {
            const scheduleDate = new Date(s.start_date).toISOString().split('T')[0];
            return scheduleDate === today;
        }).length;

        document.getElementById('activeProjects').textContent = activeProjects;
        document.getElementById('todaySchedules').textContent = todaySchedules;

    } catch (error) {
        console.error('대시보드 로드 오류:', error);
    }
}

async function loadProjects() {
    try {
        const response = await fetch(`${API_URL}/projects`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        projects = await response.json();
        displayProjects();
        updateProjectSelects();

    } catch (error) {
        console.error('프로젝트 로드 오류:', error);
    }
}

function displayProjects() {
    const container = document.getElementById('projectsList');
    if (!container) return;

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="card">
                <div class="card-body" style="text-align: center; color: var(--color-gray-500);">
                    등록된 현장이 없습니다.
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = projects.map(project => `
        <div class="card" style="cursor: pointer;">
            <div class="card-body">
                <h4>${project.name}</h4>
                <div class="text-sm text-muted mt-1">
                    ${project.client || '고객사 미정'}<br>
                    ${project.address || '주소 미등록'}<br>
                    ${formatDate(project.start_date)} ~ ${formatDate(project.end_date)}
                </div>
                <div class="mt-2">
                    <span style="padding: 2px 8px; background: var(--color-gray-100); border-radius: 4px; font-size: 12px;">
                        ${getStatusText(project.status)}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadSchedules() {
    try {
        const response = await fetch(`${API_URL}/schedules`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        schedules = await response.json();
        displayScheduleTable();

    } catch (error) {
        console.error('일정 로드 오류:', error);
    }
}

function displayScheduleTable() {
    const tbody = document.getElementById('scheduleTableBody');
    if (!tbody) return;

    if (schedules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">등록된 일정이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = schedules.map(schedule => `
        <tr>
            <td>${schedule.project_name || '-'}</td>
            <td>${schedule.title}</td>
            <td>${formatDate(schedule.start_date)} ~ ${formatDate(schedule.end_date)}</td>
            <td>
                <span class="payment-status ${schedule.status}">
                    ${getStatusText(schedule.status)}
                </span>
            </td>
            <td>${schedule.assigned_to || '-'}</td>
            <td>
                <button class="btn btn-ghost btn-sm" onclick="deleteSchedule(${schedule.id})">삭제</button>
            </td>
        </tr>
    `).join('');
}

async function loadTeam() {
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const users = await response.json();
        displayTeam(users);

    } catch (error) {
        console.error('팀원 로드 오류:', error);
    }
}

function displayTeam(users) {
    const container = document.getElementById('teamList');
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = '<p style="text-align: center;">등록된 팀원이 없습니다.</p>';
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="card">
            <div class="card-body" style="text-align: center;">
                <div style="width: 60px; height: 60px; background: var(--color-gray-200); border-radius: 50%; margin: 0 auto var(--spacing-md); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 600;">
                    ${user.name.charAt(0)}
                </div>
                <h4>${user.name}</h4>
                <div class="text-sm text-muted">
                    ${getRoleText(user.role)}<br>
                    ${user.department || '-'}
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// 유틸리티 함수
// ==========================================
function updateProjectSelects() {
    const paymentSelect = document.getElementById('paymentProject');
    const filterSelect = document.getElementById('paymentProjectFilter');

    const options = '<option value="">전체 현장</option>' +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    if (paymentSelect) {
        paymentSelect.innerHTML = '<option value="">현장을 선택하세요</option>' +
            projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    if (filterSelect) {
        filterSelect.innerHTML = options;
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
}

function getStatusText(status) {
    const statusMap = {
        'pending': '대기중',
        'in_progress': '진행중',
        'completed': '완료',
        'planning': '계획중',
        'active': '활성',
        'paused': '일시정지',
        'cancelled': '취소됨'
    };
    return statusMap[status] || status;
}

function getRoleText(role) {
    const roleMap = {
        'admin': '관리자',
        'manager': '매니저',
        'worker': '작업자'
    };
    return roleMap[role] || role;
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showNotification(message) {
    // 간단한 알림 표시
    console.log('알림:', message);
    // TODO: 실제 알림 UI 구현
}

async function deleteSchedule(id) {
    if (confirm('일정을 삭제하시겠습니까?')) {
        try {
            const response = await fetch(`${API_URL}/schedules/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                alert('일정이 삭제되었습니다.');
                loadSchedules();
            }
        } catch (error) {
            console.error('삭제 오류:', error);
            alert('삭제에 실패했습니다.');
        }
    }
}