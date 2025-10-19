// ==========================================
// 글로벌 변수 및 상태 관리
// ==========================================
let currentUser = null;
let authToken = null;
let socket = null;
let projects = [];
let schedules = [];
let currentView = 'dashboard';

// API 기본 URL
const API_URL = '/api';

// ==========================================
// 초기화 및 인증
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 저장된 토큰 확인
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        authToken = savedToken;
        verifyToken();
    }

    // 이벤트 리스너 설정
    setupEventListeners();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    // 로그인 폼
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // 로그아웃
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // 네비게이션 메뉴
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const view = item.dataset.view;
            if (view) {
                switchView(view);
            }
        });
    });

    // 사이드바 토글
    const toggleSidebar = document.getElementById('toggleSidebar');
    if (toggleSidebar) {
        toggleSidebar.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('collapsed');
        });
    }

    // 새 일정 추가
    const addScheduleBtn = document.getElementById('addScheduleBtn');
    if (addScheduleBtn) {
        addScheduleBtn.addEventListener('click', () => {
            openModal('scheduleModal');
        });
    }

    // 새 프로젝트 추가
    const addProjectBtn = document.getElementById('addProjectBtn');
    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', () => {
            openModal('projectModal');
        });
    }

    // 새로고침 버튼
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadCurrentView();
        });
    }

    // 회원가입 링크
    const showRegister = document.getElementById('showRegister');
    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            alert('관리자에게 계정 생성을 요청하세요.');
        });
    }
}

// ==========================================
// 로그인 처리
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

            // 토큰 저장
            localStorage.setItem('authToken', authToken);

            // 메인 앱 표시
            showMainApp();

            // Socket.IO 연결
            initSocketConnection();

            // 초기 데이터 로드
            await loadInitialData();
        } else {
            showError(data.error || '로그인에 실패했습니다.');
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        showError('서버 연결에 실패했습니다.');
    }
}

// 토큰 검증
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
            // 유효하지 않은 토큰
            localStorage.removeItem('authToken');
            authToken = null;
        }
    } catch (error) {
        console.error('토큰 검증 오류:', error);
        localStorage.removeItem('authToken');
        authToken = null;
    }
}

// 로그아웃 처리
function handleLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        localStorage.removeItem('authToken');
        authToken = null;
        currentUser = null;

        if (socket) {
            socket.disconnect();
        }

        // 로그인 화면으로
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
}

// ==========================================
// 화면 전환
// ==========================================
function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';

    // 사용자 정보 표시
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '관리자' :
                                                         currentUser.role === 'manager' ? '매니저' : '작업자';
    }
}

function switchView(viewName) {
    // 현재 뷰 숨기기
    document.querySelectorAll('.view-content').forEach(view => {
        view.classList.remove('active');
    });

    // 네비게이션 활성화 상태 변경
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // 선택된 뷰 표시
    const selectedView = document.getElementById(`${viewName}View`);
    if (selectedView) {
        selectedView.classList.add('active');
    }

    // 네비게이션 아이템 활성화
    const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // 페이지 제목 변경
    const titles = {
        'dashboard': '대시보드',
        'calendar': '캘린더',
        'projects': '현장 관리',
        'schedules': '일정 목록',
        'team': '팀원 관리'
    };
    document.getElementById('pageTitle').textContent = titles[viewName] || viewName;

    currentView = viewName;
    loadCurrentView();
}

function loadCurrentView() {
    switch(currentView) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'calendar':
            loadCalendar();
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
// Socket.IO 연결
// ==========================================
function initSocketConnection() {
    socket = io();

    socket.on('connect', () => {
        console.log('Socket.IO 연결됨');
    });

    socket.on('schedule-updated', (data) => {
        console.log('일정 업데이트:', data);
        if (currentView === 'schedules' || currentView === 'calendar') {
            loadSchedules();
        }
    });

    socket.on('schedule-added', (data) => {
        console.log('새 일정:', data);
        loadSchedules();
        showNotification('새로운 일정이 추가되었습니다.');
    });

    socket.on('schedule-deleted', (data) => {
        console.log('일정 삭제:', data);
        loadSchedules();
    });

    socket.on('comment-added', (data) => {
        console.log('새 댓글:', data);
        showNotification('새로운 댓글이 추가되었습니다.');
    });
}

// ==========================================
// 초기 데이터 로드
// ==========================================
async function loadInitialData() {
    try {
        await Promise.all([
            loadProjects(),
            loadSchedules(),
            loadDashboard()
        ]);
    } catch (error) {
        console.error('초기 데이터 로드 오류:', error);
    }
}

// ==========================================
// 대시보드 로드
// ==========================================
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
        document.getElementById('totalProjects').textContent = projectsData.length;

        const activeSchedules = schedulesData.filter(s => s.status === 'in_progress').length;
        const completedSchedules = schedulesData.filter(s => s.status === 'completed').length;

        document.getElementById('activeSchedules').textContent = activeSchedules;
        document.getElementById('completedSchedules').textContent = completedSchedules;

        // 오늘의 일정 표시
        displayTodaySchedules(schedulesData);

        // 활성 프로젝트 표시
        displayActiveProjects(projectsData);

    } catch (error) {
        console.error('대시보드 로드 오류:', error);
    }
}

// 오늘의 일정 표시
function displayTodaySchedules(schedules) {
    const today = new Date().toISOString().split('T')[0];
    const todaySchedules = schedules.filter(schedule => {
        const scheduleDate = new Date(schedule.start_date).toISOString().split('T')[0];
        return scheduleDate === today;
    });

    const container = document.getElementById('todaySchedules');
    if (!container) return;

    if (todaySchedules.length === 0) {
        container.innerHTML = '<p style="color: #999;">오늘 예정된 일정이 없습니다.</p>';
        return;
    }

    container.innerHTML = todaySchedules.map(schedule => `
        <div class="schedule-item">
            <div class="schedule-time">
                <span class="time">${new Date(schedule.start_date).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}</span>
            </div>
            <div class="schedule-details">
                <div class="schedule-title">${schedule.title}</div>
                <div class="schedule-location">
                    <i class="fas fa-building"></i>
                    ${schedule.project_name || '미지정'}
                </div>
            </div>
            <div class="schedule-status ${schedule.status}">
                ${getStatusText(schedule.status)}
            </div>
        </div>
    `).join('');
}

// 활성 프로젝트 표시
function displayActiveProjects(projects) {
    const activeProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'active');
    const container = document.getElementById('activeProjects');

    if (!container) return;

    if (activeProjects.length === 0) {
        container.innerHTML = '<p style="color: #999;">진행 중인 현장이 없습니다.</p>';
        return;
    }

    container.innerHTML = activeProjects.slice(0, 4).map(project => `
        <div class="project-card">
            <div class="project-header">
                <div class="project-title">${project.name}</div>
                <div class="project-status">${getStatusText(project.status)}</div>
            </div>
            <div class="project-info">
                <div class="project-info-item">
                    <i class="fas fa-user"></i>
                    <span>${project.manager_name || '미지정'}</span>
                </div>
                <div class="project-info-item">
                    <i class="fas fa-calendar"></i>
                    <span>${formatDate(project.start_date)} ~ ${formatDate(project.end_date)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// 프로젝트 관리
// ==========================================
async function loadProjects() {
    try {
        const response = await fetch(`${API_URL}/projects`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        projects = await response.json();

        // 프로젝트 수 업데이트
        document.getElementById('projectCount').textContent = projects.length;

        // 프로젝트 목록 표시
        displayProjects();

        // 프로젝트 선택 옵션 업데이트
        updateProjectSelects();

    } catch (error) {
        console.error('프로젝트 로드 오류:', error);
    }
}

function displayProjects() {
    const container = document.getElementById('projectsList');
    if (!container) return;

    if (projects.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">등록된 현장이 없습니다.</p>';
        return;
    }

    container.innerHTML = projects.map(project => `
        <div class="project-card" onclick="viewProjectDetail(${project.id})">
            <div class="project-header">
                <div class="project-title">${project.name}</div>
                <div class="project-status">${getStatusText(project.status)}</div>
            </div>
            <div class="project-info">
                <div class="project-info-item">
                    <i class="fas fa-user"></i>
                    <span>매니저: ${project.manager_name || '미지정'}</span>
                </div>
                <div class="project-info-item">
                    <i class="fas fa-building"></i>
                    <span>고객: ${project.client || '-'}</span>
                </div>
                <div class="project-info-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${project.address || '주소 미등록'}</span>
                </div>
                <div class="project-info-item">
                    <i class="fas fa-calendar"></i>
                    <span>${formatDate(project.start_date)} ~ ${formatDate(project.end_date)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// 일정 관리
// ==========================================
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
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #999;">등록된 일정이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = schedules.map(schedule => `
        <tr>
            <td>${schedule.project_name || '-'}</td>
            <td>${schedule.title}</td>
            <td>${formatDate(schedule.start_date)}</td>
            <td>${formatDate(schedule.end_date)}</td>
            <td>${schedule.assigned_to || '미지정'}</td>
            <td>
                <div class="progress-bar" style="width: 100px; height: 8px; display: inline-block;">
                    <div class="progress-fill" style="width: ${schedule.progress || 0}%"></div>
                </div>
                ${schedule.progress || 0}%
            </td>
            <td>
                <span class="schedule-status ${schedule.status}">
                    ${getStatusText(schedule.status)}
                </span>
            </td>
            <td>
                <button class="btn-icon" onclick="editSchedule(${schedule.id})" title="수정">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="deleteSchedule(${schedule.id})" title="삭제">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ==========================================
// 팀원 관리
// ==========================================
async function loadTeam() {
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const users = await response.json();
        displayTeam(users);

        // 작업자 수 업데이트
        document.getElementById('totalWorkers').textContent = users.length;

    } catch (error) {
        console.error('팀원 로드 오류:', error);
    }
}

function displayTeam(users) {
    const container = document.getElementById('teamList');
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">등록된 팀원이 없습니다.</p>';
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="team-member-card">
            <div class="member-avatar">
                ${user.name.charAt(0).toUpperCase()}
            </div>
            <div class="member-name">${user.name}</div>
            <div class="member-role">${getRoleText(user.role)} - ${user.department || '미지정'}</div>
            <div class="member-stats">
                <div class="member-stat">
                    <span class="member-stat-value">0</span>
                    <span class="member-stat-label">진행중</span>
                </div>
                <div class="member-stat">
                    <span class="member-stat-value">0</span>
                    <span class="member-stat-label">완료</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// 모달 관련
// ==========================================
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

// 일정 저장
async function saveSchedule() {
    const formData = {
        project_id: document.getElementById('scheduleProject').value,
        title: document.getElementById('scheduleTitle').value,
        description: document.getElementById('scheduleDescription').value,
        start_date: document.getElementById('scheduleStartDate').value,
        end_date: document.getElementById('scheduleEndDate').value,
        type: document.getElementById('scheduleType').value,
        priority: document.getElementById('schedulePriority').value,
        assigned_to: document.getElementById('scheduleAssignee').value
    };

    try {
        const response = await fetch(`${API_URL}/schedules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            closeModal('scheduleModal');
            showSuccess('일정이 추가되었습니다.');
            loadSchedules();

            // Socket.IO로 브로드캐스트
            if (socket) {
                socket.emit('schedule-add', { projectId: formData.project_id });
            }
        } else {
            const error = await response.json();
            showError(error.error || '일정 추가 실패');
        }
    } catch (error) {
        console.error('일정 저장 오류:', error);
        showError('일정 저장에 실패했습니다.');
    }
}

// 프로젝트 저장
async function saveProject() {
    const formData = {
        name: document.getElementById('projectName').value,
        client: document.getElementById('projectClient').value,
        address: document.getElementById('projectAddress').value,
        start_date: document.getElementById('projectStartDate').value,
        end_date: document.getElementById('projectEndDate').value,
        description: document.getElementById('projectDescription').value,
        color: document.getElementById('projectColor').value
    };

    try {
        const response = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            closeModal('projectModal');
            showSuccess('현장이 추가되었습니다.');
            loadProjects();
        } else {
            const error = await response.json();
            showError(error.error || '현장 추가 실패');
        }
    } catch (error) {
        console.error('프로젝트 저장 오류:', error);
        showError('현장 저장에 실패했습니다.');
    }
}

// ==========================================
// 유틸리티 함수
// ==========================================
function updateProjectSelects() {
    const select = document.getElementById('scheduleProject');
    const filterSelect = document.getElementById('filterProject');

    if (select) {
        select.innerHTML = '<option value="">현장을 선택하세요</option>' +
            projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">전체 현장</option>' +
            projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
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

function showError(message) {
    alert('오류: ' + message);
}

function showSuccess(message) {
    alert('성공: ' + message);
}

function showNotification(message) {
    // 나중에 더 나은 알림 시스템으로 교체
    console.log('알림:', message);
}

// 일정 수정
async function editSchedule(id) {
    // 일정 정보 로드 후 모달 열기
    alert('일정 수정 기능은 개발 중입니다.');
}

// 일정 삭제
async function deleteSchedule(id) {
    if (confirm('정말로 이 일정을 삭제하시겠습니까?')) {
        try {
            const response = await fetch(`${API_URL}/schedules/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                showSuccess('일정이 삭제되었습니다.');
                loadSchedules();
            } else {
                const error = await response.json();
                showError(error.error || '일정 삭제 실패');
            }
        } catch (error) {
            console.error('일정 삭제 오류:', error);
            showError('일정 삭제에 실패했습니다.');
        }
    }
}

// 프로젝트 상세 보기
function viewProjectDetail(id) {
    // 프로젝트 상세 페이지로 이동 또는 모달 표시
    alert(`프로젝트 ${id} 상세 정보`);
}