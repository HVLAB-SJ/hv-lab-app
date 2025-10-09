// ==========================================
// 프로젝트(현장) 관리 기능
// ==========================================

let editingProjectId = null;

// 프로젝트 상세 보기
function viewProjectDetail(id) {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    showProjectDetailModal(project);
    loadProjectStats(id);
}

// 프로젝트 상세 모달 표시
function showProjectDetailModal(project) {
    const modalContent = `
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>${project.name}</h2>
                <div style="display: flex; gap: 10px;">
                    <button onclick="editProject(${project.id})" style="padding: 8px 15px; background: #4A90E2; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        <i class="fas fa-edit"></i> 수정
                    </button>
                    <button onclick="viewProjectSchedules(${project.id})" style="padding: 8px 15px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        <i class="fas fa-calendar"></i> 일정 보기
                    </button>
                </div>
            </div>

            <div style="display: grid; gap: 15px;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <strong>상태:</strong>
                    <span class="project-status">${getStatusText(project.status)}</span>
                </div>
                <div>
                    <strong>고객사:</strong> ${project.client || '-'}
                </div>
                <div>
                    <strong>현장 주소:</strong> ${project.address || '-'}
                </div>
                <div>
                    <strong>담당 매니저:</strong> ${project.manager_name || '미지정'}
                </div>
                <div>
                    <strong>프로젝트 기간:</strong> ${formatDate(project.start_date)} ~ ${formatDate(project.end_date)}
                </div>
                <div>
                    <strong>프로젝트 색상:</strong>
                    <span style="display: inline-block; width: 20px; height: 20px; background: ${project.color}; border-radius: 3px; vertical-align: middle;"></span>
                </div>
                <div>
                    <strong>설명:</strong><br>
                    <p style="margin-top: 5px; padding: 10px; background: #f5f5f5; border-radius: 5px;">
                        ${project.description || '설명이 없습니다.'}
                    </p>
                </div>
                <div id="projectStats-${project.id}" style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin-top: 10px;">
                    <div class="spinner"></div>
                </div>
            </div>

            <div style="margin-top: 20px; text-align: right;">
                <button onclick="closeProjectDetailModal()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    닫기
                </button>
            </div>
        </div>
    `;

    // 임시 모달 생성
    const modal = document.createElement('div');
    modal.id = 'projectDetailModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            ${modalContent}
        </div>
    `;
    document.body.appendChild(modal);
}

function closeProjectDetailModal() {
    const modal = document.getElementById('projectDetailModal');
    if (modal) {
        modal.remove();
    }
}

// 프로젝트 통계 로드
async function loadProjectStats(projectId) {
    try {
        const response = await fetch(`${API_URL}/projects/${projectId}/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const stats = await response.json();
            displayProjectStats(projectId, stats);
        }
    } catch (error) {
        console.error('프로젝트 통계 로드 오류:', error);
    }
}

// 프로젝트 통계 표시
function displayProjectStats(projectId, stats) {
    const container = document.getElementById(`projectStats-${projectId}`);
    if (!container) return;

    const avgProgress = Math.round(stats.average_progress || 0);

    container.innerHTML = `
        <h4 style="margin-bottom: 15px;">프로젝트 통계</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div>
                <strong>전체 일정:</strong> ${stats.total_schedules || 0}개
            </div>
            <div>
                <strong>완료된 일정:</strong> ${stats.completed_schedules || 0}개
            </div>
            <div>
                <strong>진행중 일정:</strong> ${stats.in_progress_schedules || 0}개
            </div>
            <div>
                <strong>대기중 일정:</strong> ${stats.pending_schedules || 0}개
            </div>
        </div>
        <div style="margin-top: 15px;">
            <strong>평균 진행률:</strong>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
                <div class="progress-bar" style="flex: 1; height: 20px;">
                    <div class="progress-fill" style="width: ${avgProgress}%; background: ${getProgressColor(avgProgress)}; height: 100%;"></div>
                </div>
                <span>${avgProgress}%</span>
            </div>
        </div>
    `;
}

// 프로젝트 일정 보기
function viewProjectSchedules(projectId) {
    closeProjectDetailModal();

    // 일정 뷰로 전환하고 필터 적용
    switchView('schedules');

    // 프로젝트 필터 설정
    setTimeout(() => {
        const filterSelect = document.getElementById('filterProject');
        if (filterSelect) {
            filterSelect.value = projectId;
            filterSchedules();
        }
    }, 100);
}

// 프로젝트 수정
async function editProject(id) {
    editingProjectId = id;
    const project = projects.find(p => p.id === id);

    if (!project) return;

    // 상세 모달 닫기
    closeProjectDetailModal();

    // 수정 모달 열기
    openModal('projectModal');

    // 폼 필드 채우기
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectClient').value = project.client || '';
    document.getElementById('projectAddress').value = project.address || '';
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectColor').value = project.color || '#4A90E2';

    // 날짜 필드
    if (project.start_date) {
        document.getElementById('projectStartDate').value = project.start_date.split('T')[0];
    }
    if (project.end_date) {
        document.getElementById('projectEndDate').value = project.end_date.split('T')[0];
    }

    // 모달 제목 변경
    const modalHeader = document.querySelector('#projectModal .modal-header h3');
    if (modalHeader) {
        modalHeader.textContent = '현장 정보 수정';
    }
}

// 프로젝트 저장 (수정된 버전)
window.saveProject = async function() {
    const formData = {
        name: document.getElementById('projectName').value,
        client: document.getElementById('projectClient').value,
        address: document.getElementById('projectAddress').value,
        start_date: document.getElementById('projectStartDate').value,
        end_date: document.getElementById('projectEndDate').value,
        description: document.getElementById('projectDescription').value,
        color: document.getElementById('projectColor').value,
        status: 'planning' // 기본값
    };

    // 유효성 검사
    if (!formData.name) {
        showError('현장명은 필수 항목입니다.');
        return;
    }

    // 날짜 유효성 검사
    if (formData.start_date && formData.end_date) {
        if (new Date(formData.start_date) > new Date(formData.end_date)) {
            showError('종료일은 시작일보다 늦어야 합니다.');
            return;
        }
    }

    try {
        const url = editingProjectId
            ? `${API_URL}/projects/${editingProjectId}`
            : `${API_URL}/projects`;

        const method = editingProjectId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            closeModal('projectModal');
            showSuccess(editingProjectId ? '현장 정보가 수정되었습니다.' : '새 현장이 추가되었습니다.');

            // 초기화
            editingProjectId = null;
            document.getElementById('projectForm').reset();

            // 모달 제목 원래대로
            const modalHeader = document.querySelector('#projectModal .modal-header h3');
            if (modalHeader) {
                modalHeader.textContent = '새 현장 추가';
            }

            // 목록 새로고침
            loadProjects();
        } else {
            const error = await response.json();
            showError(error.error || '현장 저장 실패');
        }
    } catch (error) {
        console.error('프로젝트 저장 오류:', error);
        showError('현장 저장에 실패했습니다.');
    }
};

// 프로젝트 삭제
async function deleteProject(id) {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    if (confirm(`정말로 "${project.name}" 현장을 삭제하시겠습니까?\n관련된 모든 일정도 함께 삭제됩니다.`)) {
        try {
            const response = await fetch(`${API_URL}/projects/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                showSuccess('현장이 삭제되었습니다.');
                closeProjectDetailModal();
                loadProjects();
                loadSchedules(); // 일정도 새로고침
            } else {
                const error = await response.json();
                showError(error.error || '현장 삭제 실패');
            }
        } catch (error) {
            console.error('프로젝트 삭제 오류:', error);
            showError('현장 삭제에 실패했습니다.');
        }
    }
}

// 프로젝트 상태 변경
async function changeProjectStatus(id, newStatus) {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    try {
        const response = await fetch(`${API_URL}/projects/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ ...project, status: newStatus })
        });

        if (response.ok) {
            showSuccess('프로젝트 상태가 변경되었습니다.');
            loadProjects();
        } else {
            const error = await response.json();
            showError(error.error || '상태 변경 실패');
        }
    } catch (error) {
        console.error('프로젝트 상태 변경 오류:', error);
        showError('상태 변경에 실패했습니다.');
    }
}

// 프로젝트 빠른 작업 메뉴
function showProjectQuickActions(projectId, event) {
    event.stopPropagation();

    // 기존 메뉴 제거
    const existingMenu = document.getElementById('quickActionsMenu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const menu = document.createElement('div');
    menu.id = 'quickActionsMenu';
    menu.style.cssText = `
        position: absolute;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 1000;
        min-width: 150px;
    `;

    menu.innerHTML = `
        <div style="cursor: pointer; padding: 8px; hover: background: #f5f5f5;" onclick="viewProjectDetail(${projectId})">
            <i class="fas fa-eye"></i> 상세보기
        </div>
        <div style="cursor: pointer; padding: 8px;" onclick="editProject(${projectId})">
            <i class="fas fa-edit"></i> 수정
        </div>
        <div style="cursor: pointer; padding: 8px;" onclick="viewProjectSchedules(${projectId})">
            <i class="fas fa-calendar"></i> 일정보기
        </div>
        <hr style="margin: 5px 0;">
        <div style="cursor: pointer; padding: 8px; color: red;" onclick="deleteProject(${projectId})">
            <i class="fas fa-trash"></i> 삭제
        </div>
    `;

    // 메뉴 위치 설정
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';

    document.body.appendChild(menu);

    // 외부 클릭 시 메뉴 닫기
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        });
    }, 100);
}

// 프로젝트 검색
function searchProjects(keyword) {
    const filteredProjects = projects.filter(project =>
        project.name.toLowerCase().includes(keyword.toLowerCase()) ||
        (project.client && project.client.toLowerCase().includes(keyword.toLowerCase())) ||
        (project.address && project.address.toLowerCase().includes(keyword.toLowerCase()))
    );

    displayProjects(filteredProjects);
}

// 프로젝트 정렬
function sortProjects(sortBy) {
    let sortedProjects = [...projects];

    switch (sortBy) {
        case 'name':
            sortedProjects.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'date':
            sortedProjects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'status':
            sortedProjects.sort((a, b) => a.status.localeCompare(b.status));
            break;
    }

    displayProjects(sortedProjects);
}