// ==========================================
// 캘린더 기능
// ==========================================

let currentDate = new Date();
let currentViewMode = 'month'; // month, week, day
let calendarSchedules = [];

// 캘린더 초기화
function initCalendar() {
    updateCalendarHeader();
    renderCalendar();
    setupCalendarEvents();
}

// 캘린더 이벤트 설정
function setupCalendarEvents() {
    // 이전/다음 월 버튼
    document.getElementById('prevMonth')?.addEventListener('click', () => {
        changeMonth(-1);
    });

    document.getElementById('nextMonth')?.addEventListener('click', () => {
        changeMonth(1);
    });

    // 뷰 모드 변경 버튼
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const viewMode = e.target.dataset.view;
            if (viewMode) {
                changeViewMode(viewMode);
            }
        });
    });
}

// 캘린더 로드
async function loadCalendar() {
    try {
        // 현재 월의 일정 가져오기
        const startDate = getMonthStartDate(currentDate);
        const endDate = getMonthEndDate(currentDate);

        const response = await fetch(`${API_URL}/schedules?start_date=${startDate}&end_date=${endDate}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            calendarSchedules = await response.json();
            renderCalendar();
        }
    } catch (error) {
        console.error('캘린더 로드 오류:', error);
    }

    // 캘린더 초기화
    initCalendar();
}

// 월 변경
function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    updateCalendarHeader();
    renderCalendar();
    loadCalendarSchedules();
}

// 뷰 모드 변경
function changeViewMode(mode) {
    currentViewMode = mode;

    // 버튼 활성화 상태 변경
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.btn-view[data-view="${mode}"]`)?.classList.add('active');

    renderCalendar();
}

// 캘린더 헤더 업데이트
function updateCalendarHeader() {
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const year = currentDate.getFullYear();
    const month = monthNames[currentDate.getMonth()];

    const headerElement = document.getElementById('currentMonth');
    if (headerElement) {
        headerElement.textContent = `${year}년 ${month}`;
    }
}

// 캘린더 렌더링
function renderCalendar() {
    const calendarContainer = document.getElementById('calendar');
    if (!calendarContainer) return;

    switch (currentViewMode) {
        case 'month':
            renderMonthView(calendarContainer);
            break;
        case 'week':
            renderWeekView(calendarContainer);
            break;
        case 'day':
            renderDayView(calendarContainer);
            break;
    }
}

// 월 보기 렌더링
function renderMonthView(container) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);

    const firstDayOfWeek = firstDay.getDay();
    const lastDate = lastDay.getDate();
    const prevLastDate = prevLastDay.getDate();

    let html = '';

    // 요일 헤더
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    dayNames.forEach(day => {
        html += `<div class="calendar-header-day">${day}</div>`;
    });

    // 이전 달 날짜
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const date = prevLastDate - i;
        html += `<div class="calendar-day other-month">
            <div class="calendar-day-header">${date}</div>
            <div class="calendar-events"></div>
        </div>`;
    }

    // 현재 달 날짜
    const today = new Date();
    for (let date = 1; date <= lastDate; date++) {
        const currentDateObj = new Date(year, month, date);
        const isToday = today.getFullYear() === year &&
                       today.getMonth() === month &&
                       today.getDate() === date;

        const daySchedules = getSchedulesForDate(currentDateObj);

        html += `<div class="calendar-day ${isToday ? 'today' : ''}" data-date="${formatDateForData(currentDateObj)}">
            <div class="calendar-day-header">${date}</div>
            <div class="calendar-events">
                ${renderDayEvents(daySchedules)}
            </div>
        </div>`;
    }

    // 다음 달 날짜
    const totalCells = 42; // 6주 * 7일
    const currentCells = firstDayOfWeek + lastDate;
    const nextDays = totalCells - currentCells;

    for (let date = 1; date <= nextDays; date++) {
        html += `<div class="calendar-day other-month">
            <div class="calendar-day-header">${date}</div>
            <div class="calendar-events"></div>
        </div>`;
    }

    container.innerHTML = html;
}

// 주 보기 렌더링
function renderWeekView(container) {
    const startOfWeek = getStartOfWeek(currentDate);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    let html = '<div class="week-view">';

    // 시간 컬럼
    html += '<div class="time-column">';
    html += '<div class="time-header"></div>';
    for (let hour = 0; hour < 24; hour++) {
        html += `<div class="time-slot">${hour.toString().padStart(2, '0')}:00</div>`;
    }
    html += '</div>';

    // 각 요일 컬럼
    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        const daySchedules = getSchedulesForDate(currentDay);

        html += '<div class="day-column">';
        html += `<div class="day-header">
            <div class="day-name">${dayNames[i]}</div>
            <div class="day-date">${currentDay.getDate()}</div>
        </div>`;

        html += '<div class="day-content">';
        for (let hour = 0; hour < 24; hour++) {
            html += `<div class="hour-slot" data-hour="${hour}">
                ${renderHourEvents(daySchedules, hour)}
            </div>`;
        }
        html += '</div>';
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}

// 일 보기 렌더링
function renderDayView(container) {
    const daySchedules = getSchedulesForDate(currentDate);
    let html = '<div class="day-view">';

    // 날짜 헤더
    html += `<div class="day-view-header">
        <h3>${currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</h3>
    </div>`;

    // 시간별 슬롯
    html += '<div class="day-timeline">';
    for (let hour = 0; hour < 24; hour++) {
        const hourSchedules = daySchedules.filter(schedule => {
            const scheduleHour = new Date(schedule.start_date).getHours();
            return scheduleHour === hour;
        });

        html += `<div class="timeline-hour">
            <div class="hour-label">${hour.toString().padStart(2, '0')}:00</div>
            <div class="hour-content">
                ${renderHourEvents(hourSchedules, hour)}
            </div>
        </div>`;
    }
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
}

// 날짜별 일정 가져오기
function getSchedulesForDate(date) {
    const dateStr = formatDateForComparison(date);
    return calendarSchedules.filter(schedule => {
        const startDate = formatDateForComparison(new Date(schedule.start_date));
        const endDate = formatDateForComparison(new Date(schedule.end_date));
        return dateStr >= startDate && dateStr <= endDate;
    });
}

// 일정 이벤트 렌더링
function renderDayEvents(schedules) {
    if (!schedules || schedules.length === 0) return '';

    return schedules.slice(0, 3).map(schedule => {
        const projectColor = schedule.project_color || '#4A90E2';
        return `<div class="calendar-event" style="background-color: ${projectColor}; color: white;"
                     onclick="viewScheduleDetail(${schedule.id})" title="${schedule.title}">
            ${schedule.title}
        </div>`;
    }).join('');
}

// 시간대별 이벤트 렌더링
function renderHourEvents(schedules, hour) {
    const hourSchedules = schedules.filter(schedule => {
        const scheduleHour = new Date(schedule.start_date).getHours();
        return scheduleHour === hour;
    });

    if (hourSchedules.length === 0) return '';

    return hourSchedules.map(schedule => {
        const projectColor = schedule.project_color || '#4A90E2';
        return `<div class="hour-event" style="background-color: ${projectColor};"
                     onclick="viewScheduleDetail(${schedule.id})">
            <div class="event-time">${formatTime(schedule.start_date)}</div>
            <div class="event-title">${schedule.title}</div>
        </div>`;
    }).join('');
}

// 캘린더 일정 로드
async function loadCalendarSchedules() {
    try {
        const startDate = getMonthStartDate(currentDate);
        const endDate = getMonthEndDate(currentDate);

        const response = await fetch(
            `${API_URL}/schedules?start_date=${startDate}&end_date=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        if (response.ok) {
            calendarSchedules = await response.json();
            renderCalendar();
        }
    } catch (error) {
        console.error('캘린더 일정 로드 오류:', error);
    }
}

// 일정 상세 보기
function viewScheduleDetail(scheduleId) {
    const schedule = calendarSchedules.find(s => s.id === scheduleId);
    if (schedule) {
        alert(`일정: ${schedule.title}\n시작: ${formatDateTime(schedule.start_date)}\n종료: ${formatDateTime(schedule.end_date)}\n설명: ${schedule.description || '없음'}`);
    }
}

// ==========================================
// 유틸리티 함수
// ==========================================

// 주의 시작일 구하기
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

// 월의 시작일
function getMonthStartDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
}

// 월의 종료일
function getMonthEndDate(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
}

// 날짜 포맷 (데이터용)
function formatDateForData(date) {
    return date.toISOString().split('T')[0];
}

// 날짜 포맷 (비교용)
function formatDateForComparison(date) {
    return date.toISOString().split('T')[0];
}

// 시간 포맷
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

// 날짜시간 포맷
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
}

// 캘린더 스타일 추가
const calendarStyles = `
<style>
/* 캘린더 추가 스타일 */
.calendar-header-day {
    background: var(--light);
    padding: 10px;
    text-align: center;
    font-weight: 600;
    color: var(--dark);
}

.week-view {
    display: flex;
    height: 600px;
    overflow-y: auto;
}

.time-column {
    width: 80px;
    border-right: 1px solid #E5E7EB;
}

.time-header {
    height: 50px;
    border-bottom: 1px solid #E5E7EB;
}

.time-slot {
    height: 60px;
    padding: 5px 10px;
    border-bottom: 1px solid #F0F0F0;
    font-size: 12px;
    color: var(--gray);
}

.day-column {
    flex: 1;
    border-right: 1px solid #E5E7EB;
}

.day-header {
    height: 50px;
    padding: 10px;
    text-align: center;
    border-bottom: 1px solid #E5E7EB;
    background: var(--light);
}

.day-name {
    font-weight: 600;
    font-size: 14px;
}

.day-date {
    font-size: 18px;
    color: var(--primary-color);
}

.day-content {
    position: relative;
}

.hour-slot {
    height: 60px;
    border-bottom: 1px solid #F0F0F0;
    padding: 2px;
    position: relative;
}

.hour-event {
    background: var(--primary-color);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    margin-bottom: 2px;
    cursor: pointer;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.day-view {
    padding: 20px;
}

.day-view-header {
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #E5E7EB;
}

.day-timeline {
    background: white;
}

.timeline-hour {
    display: flex;
    border-bottom: 1px solid #E5E7EB;
    min-height: 60px;
}

.hour-label {
    width: 100px;
    padding: 10px;
    color: var(--gray);
    font-size: 14px;
}

.hour-content {
    flex: 1;
    padding: 10px;
}

.event-time {
    font-size: 10px;
    opacity: 0.9;
}

.event-title {
    font-weight: 500;
}
</style>
`;

// 스타일 주입
if (!document.getElementById('calendar-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'calendar-styles';
    styleElement.innerHTML = calendarStyles;
    document.head.appendChild(styleElement);
}