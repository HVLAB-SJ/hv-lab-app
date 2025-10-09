// ==========================================
// 일정 관리 기능
// ==========================================

// 일정 관련 전역 변수
let editingScheduleId = null;
let selectedProjectId = null;

// 일정 필터링
function filterSchedules() {
    const projectFilter = document.getElementById('filterProject')?.value;
    const statusFilter = document.getElementById('filterStatus')?.value;

    let filteredSchedules = [...schedules];

    if (projectFilter) {
        filteredSchedules = filteredSchedules.filter(s => s.project_id == projectFilter);
    }

    if (statusFilter) {
        filteredSchedules = filteredSchedules.filter(s => s.status === statusFilter);
    }

    displayFilteredScheduleTable(filteredSchedules);
}

// 필터링된 일정 표시
function displayFilteredScheduleTable(filteredSchedules) {
    const tbody = document.getElementById('scheduleTableBody');
    if (!tbody) return;

    if (filteredSchedules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #999;">해당하는 일정이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = filteredSchedules.map(schedule => `
        <tr>
            <td>
                <span style="color: ${schedule.project_color || '#4A90E2'};">
                    ${schedule.project_name || '-'}
                </span>
            </td>
            <td>
                <strong>${schedule.title}</strong>
                ${schedule.priority === 'urgent' ? '<span style="color: red; margin-left: 5px;">🔥</span>' : ''}
            </td>
            <td>${formatDate(schedule.start_date)}</td>
            <td>${formatDate(schedule.end_date)}</td>
            <td>${schedule.assigned_to || '미지정'}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="progress-bar" style="width: 100px; height: 8px; flex: 1;">
                        <div class="progress-fill" style="width: ${schedule.progress || 0}%; background: ${getProgressColor(schedule.progress)}"></div>
                    </div>
                    <span style="min-width: 40px; text-align: right;">${schedule.progress || 0}%</span>
                </div>
            </td>
            <td>
                <span class="schedule-status ${schedule.status}">
                    ${getStatusText(schedule.status)}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-icon" onclick="viewScheduleDetails(${schedule.id})" title="상세보기">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="editSchedule(${schedule.id})" title="수정">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="updateScheduleProgress(${schedule.id})" title="진행률 업데이트">
                        <i class="fas fa-percentage"></i>
                    </button>
                    <button class="btn-icon" onclick="deleteSchedule(${schedule.id})" title="삭제" style="color: var(--danger-color);">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// 일정 상세 보기
async function viewScheduleDetails(id) {
    try {
        const response = await fetch(`${API_URL}/schedules/${id}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const schedule = await response.json();
            showScheduleDetailsModal(schedule);
        }
    } catch (error) {
        console.error('일정 상세 조회 오류:', error);
    }
}

// 일정 상세 모달 표시
function showScheduleDetailsModal(schedule) {
    const modalContent = `
        <div style="padding: 20px;">
            <h2 style="margin-bottom: 20px;">${schedule.title}</h2>

            <div style="display: grid; gap: 15px;">
                <div>
                    <strong>프로젝트:</strong> ${schedule.project_name || '-'}
                </div>
                <div>
                    <strong>유형:</strong> ${getTypeText(schedule.type)}
                </div>
                <div>
                    <strong>기간:</strong> ${formatDateTime(schedule.start_date)} ~ ${formatDateTime(schedule.end_date)}
                </div>
                <div>
                    <strong>상태:</strong> <span class="schedule-status ${schedule.status}">${getStatusText(schedule.status)}</span>
                </div>
                <div>
                    <strong>우선순위:</strong> ${getPriorityText(schedule.priority)}
                </div>
                <div>
                    <strong>진행률:</strong> ${schedule.progress || 0}%
                </div>
                <div>
                    <strong>담당자:</strong> ${schedule.assigned_to || '미지정'}
                </div>
                ${schedule.assignees && schedule.assignees.length > 0 ? `
                <div>
                    <strong>팀원:</strong> ${schedule.assignees.map(a => a.name).join(', ')}
                </div>
                ` : ''}
                <div>
                    <strong>설명:</strong><br>
                    <p style="margin-top: 5px; padding: 10px; background: #f5f5f5; border-radius: 5px;">
                        ${schedule.description || '설명이 없습니다.'}
                    </p>
                </div>
                <div>
                    <strong>생성자:</strong> ${schedule.creator_name || '-'}
                </div>
                <div>
                    <strong>생성일:</strong> ${formatDateTime(schedule.created_at)}
                </div>
                <div>
                    <strong>최종 수정일:</strong> ${formatDateTime(schedule.updated_at)}
                </div>
            </div>

            <div style="margin-top: 20px; text-align: right;">
                <button onclick="closeScheduleDetailsModal()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    닫기
                </button>
            </div>
        </div>
    `;

    // 임시 모달 생성
    const modal = document.createElement('div');
    modal.id = 'scheduleDetailsModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            ${modalContent}
        </div>
    `;
    document.body.appendChild(modal);
}

function closeScheduleDetailsModal() {
    const modal = document.getElementById('scheduleDetailsModal');
    if (modal) {
        modal.remove();
    }
}

// 일정 수정
async function editSchedule(id) {
    editingScheduleId = id;

    try {
        const response = await fetch(`${API_URL}/schedules/${id}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const schedule = await response.json();

            // 모달 열기
            openModal('scheduleModal');

            // 제목 변경
            document.getElementById('modalTitle').textContent = '일정 수정';

            // 폼 필드 채우기
            document.getElementById('scheduleProject').value = schedule.project_id;
            document.getElementById('scheduleTitle').value = schedule.title;
            document.getElementById('scheduleDescription').value = schedule.description || '';
            document.getElementById('scheduleType').value = schedule.type;
            document.getElementById('schedulePriority').value = schedule.priority;
            document.getElementById('scheduleAssignee').value = schedule.assigned_to || '';

            // 날짜 포맷 변환
            const startDate = new Date(schedule.start_date);
            const endDate = new Date(schedule.end_date);

            document.getElementById('scheduleStartDate').value = formatDateTimeForInput(startDate);
            document.getElementById('scheduleEndDate').value = formatDateTimeForInput(endDate);
        }
    } catch (error) {
        console.error('일정 정보 로드 오류:', error);
        showError('일정 정보를 불러올 수 없습니다.');
    }
}

// 일정 저장 (수정된 버전)
window.saveSchedule = async function() {
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

    // 유효성 검사
    if (!formData.project_id || !formData.title || !formData.start_date || !formData.end_date) {
        showError('필수 항목을 모두 입력해주세요.');
        return;
    }

    // 날짜 유효성 검사
    if (new Date(formData.start_date) > new Date(formData.end_date)) {
        showError('종료일은 시작일보다 늦어야 합니다.');
        return;
    }

    try {
        const url = editingScheduleId
            ? `${API_URL}/schedules/${editingScheduleId}`
            : `${API_URL}/schedules`;

        const method = editingScheduleId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            closeModal('scheduleModal');
            showSuccess(editingScheduleId ? '일정이 수정되었습니다.' : '일정이 추가되었습니다.');

            // Socket.IO로 브로드캐스트
            if (socket) {
                const eventType = editingScheduleId ? 'schedule-update' : 'schedule-add';
                socket.emit(eventType, { projectId: formData.project_id });
            }

            // 초기화
            editingScheduleId = null;
            document.getElementById('modalTitle').textContent = '새 일정 추가';
            document.getElementById('scheduleForm').reset();

            // 목록 새로고침
            loadSchedules();
        } else {
            const error = await response.json();
            showError(error.error || '일정 저장 실패');
        }
    } catch (error) {
        console.error('일정 저장 오류:', error);
        showError('일정 저장에 실패했습니다.');
    }
};

// 진행률 업데이트
async function updateScheduleProgress(id) {
    const currentSchedule = schedules.find(s => s.id === id);
    if (!currentSchedule) return;

    const newProgress = prompt(`진행률을 입력하세요 (0-100):\n현재: ${currentSchedule.progress || 0}%`, currentSchedule.progress || 0);

    if (newProgress === null) return;

    const progress = parseInt(newProgress);
    if (isNaN(progress) || progress < 0 || progress > 100) {
        showError('0에서 100 사이의 숫자를 입력해주세요.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/schedules/${id}/progress`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ progress })
        });

        if (response.ok) {
            showSuccess('진행률이 업데이트되었습니다.');

            // Socket.IO로 브로드캐스트
            if (socket && currentSchedule.project_id) {
                socket.emit('schedule-update', {
                    projectId: currentSchedule.project_id,
                    scheduleId: id,
                    progress: progress
                });
            }

            loadSchedules();
        } else {
            const error = await response.json();
            showError(error.error || '진행률 업데이트 실패');
        }
    } catch (error) {
        console.error('진행률 업데이트 오류:', error);
        showError('진행률 업데이트에 실패했습니다.');
    }
}

// 일정에 댓글 추가
async function addComment(scheduleId) {
    const comment = prompt('댓글을 입력하세요:');
    if (!comment) return;

    try {
        const response = await fetch(`${API_URL}/schedules/${scheduleId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ content: comment })
        });

        if (response.ok) {
            showSuccess('댓글이 추가되었습니다.');

            // Socket.IO로 브로드캐스트
            if (socket) {
                const schedule = schedules.find(s => s.id === scheduleId);
                if (schedule) {
                    socket.emit('comment-add', {
                        projectId: schedule.project_id,
                        scheduleId: scheduleId
                    });
                }
            }
        } else {
            const error = await response.json();
            showError(error.error || '댓글 추가 실패');
        }
    } catch (error) {
        console.error('댓글 추가 오류:', error);
        showError('댓글 추가에 실패했습니다.');
    }
}

// 유틸리티 함수들
function getProgressColor(progress) {
    if (progress >= 80) return '#28a745';
    if (progress >= 50) return '#ffc107';
    if (progress >= 20) return '#17a2b8';
    return '#6c757d';
}

function getTypeText(type) {
    const typeMap = {
        'construction': '시공',
        'design': '설계',
        'meeting': '미팅',
        'inspection': '검수'
    };
    return typeMap[type] || type;
}

function getPriorityText(priority) {
    const priorityMap = {
        'low': '낮음',
        'normal': '보통',
        'high': '높음',
        'urgent': '긴급'
    };
    return priorityMap[priority] || priority;
}

function formatDateTimeForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
}

// 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', () => {
    // 필터 이벤트
    document.getElementById('filterProject')?.addEventListener('change', filterSchedules);
    document.getElementById('filterStatus')?.addEventListener('change', filterSchedules);
});