// ==========================================
// 결제 요청 관리
// ==========================================

let paymentRequests = [];
let editingPaymentId = null;

// 결제 요청 목록 로드
async function loadPayments() {
    try {
        const response = await fetch(`${API_URL}/payments`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            paymentRequests = await response.json();
            displayPayments();
            updateDashboardStats();
        }
    } catch (error) {
        console.error('결제 요청 로드 오류:', error);
    }
}

// 결제 요청 표시
function displayPayments() {
    const container = document.getElementById('paymentsList');
    if (!container) return;

    const statusFilter = document.getElementById('paymentStatusFilter')?.value;
    const projectFilter = document.getElementById('paymentProjectFilter')?.value;

    let filtered = [...paymentRequests];

    if (statusFilter) {
        filtered = filtered.filter(p => p.status === statusFilter);
    }
    if (projectFilter) {
        filtered = filtered.filter(p => p.project_id == projectFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="card">
                <div class="card-body" style="text-align: center; color: var(--color-gray-500);">
                    결제 요청이 없습니다.
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(payment => `
        <div class="payment-card">
            <div class="payment-header">
                <div>
                    <div class="payment-amount">${formatCurrency(payment.amount)}</div>
                    <div class="text-sm text-muted mt-1">${payment.description}</div>
                </div>
                <span class="payment-status ${payment.status}">${getPaymentStatusText(payment.status)}</span>
            </div>

            <div class="payment-details mt-2">
                ${payment.vendor_name ? `<div>업체: ${payment.vendor_name}</div>` : ''}
                ${payment.project_name ? `<div>현장: ${payment.project_name}</div>` : ''}
                ${payment.account_holder ? `
                    <div style="margin-top: var(--spacing-sm);">
                        <strong>입금정보:</strong><br>
                        ${payment.bank_name} ${payment.account_number}<br>
                        예금주: ${payment.account_holder}
                    </div>
                ` : ''}
            </div>

            <div class="payment-meta">
                <span>요청자: ${payment.requester_name}</span>
                <span>${formatDate(payment.created_at)}</span>
            </div>

            ${getPaymentActions(payment)}
        </div>
    `).join('');
}

// 결제 요청 액션 버튼
function getPaymentActions(payment) {
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
    const isOwner = payment.user_id === currentUser?.id;

    let actions = '<div style="display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-md);">';

    if (payment.status === 'pending') {
        if (isAdmin) {
            actions += `
                <button class="btn btn-primary" onclick="approvePayment(${payment.id})">승인</button>
                <button class="btn btn-secondary" onclick="rejectPayment(${payment.id})">거절</button>
            `;
        }
        if (isOwner) {
            actions += `
                <button class="btn btn-secondary" onclick="editPayment(${payment.id})">수정</button>
                <button class="btn btn-ghost" onclick="deletePayment(${payment.id})">삭제</button>
            `;
        }
    } else if (payment.status === 'approved' && isAdmin) {
        actions += `
            <button class="btn btn-primary" onclick="completePayment(${payment.id})">결제완료</button>
        `;
    }

    actions += '</div>';
    return actions;
}

// 새 결제 요청
function showPaymentModal() {
    editingPaymentId = null;
    document.getElementById('paymentForm').reset();
    openModal('paymentModal');
}

// 결제 요청 저장
async function savePaymentRequest() {
    const formData = {
        project_id: document.getElementById('paymentProject').value,
        request_type: document.getElementById('paymentType').value,
        vendor_name: document.getElementById('vendorName').value,
        description: document.getElementById('paymentDescription').value,
        amount: parseInt(document.getElementById('paymentAmount').value),
        account_holder: document.getElementById('accountHolder').value,
        bank_name: document.getElementById('bankName').value,
        account_number: document.getElementById('accountNumber').value,
        notes: document.getElementById('paymentNotes').value
    };

    // 유효성 검사
    if (!formData.description || !formData.amount) {
        alert('필수 항목을 입력해주세요.');
        return;
    }

    try {
        const url = editingPaymentId
            ? `${API_URL}/payments/${editingPaymentId}`
            : `${API_URL}/payments`;

        const method = editingPaymentId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            closeModal('paymentModal');
            alert(editingPaymentId ? '결제 요청이 수정되었습니다.' : '결제 요청이 등록되었습니다.');
            loadPayments();

            // 실시간 알림
            if (socket && !editingPaymentId) {
                socket.emit('payment-request', {
                    amount: formData.amount,
                    description: formData.description
                });
            }
        } else {
            const error = await response.json();
            alert(error.error || '요청 처리 실패');
        }
    } catch (error) {
        console.error('결제 요청 저장 오류:', error);
        alert('결제 요청 저장에 실패했습니다.');
    }
}

// 결제 승인
async function approvePayment(id) {
    if (!confirm('이 결제 요청을 승인하시겠습니까?')) return;

    try {
        const response = await fetch(`${API_URL}/payments/${id}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            alert('결제 요청이 승인되었습니다.');
            loadPayments();
        }
    } catch (error) {
        console.error('승인 오류:', error);
        alert('승인 처리에 실패했습니다.');
    }
}

// 결제 거절
async function rejectPayment(id) {
    const reason = prompt('거절 사유를 입력하세요:');
    if (!reason) return;

    try {
        const response = await fetch(`${API_URL}/payments/${id}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ reason })
        });

        if (response.ok) {
            alert('결제 요청이 거절되었습니다.');
            loadPayments();
        }
    } catch (error) {
        console.error('거절 오류:', error);
        alert('거절 처리에 실패했습니다.');
    }
}

// 결제 완료
async function completePayment(id) {
    if (!confirm('결제가 완료되었습니까?')) return;

    try {
        const response = await fetch(`${API_URL}/payments/${id}/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            alert('결제가 완료 처리되었습니다.');
            loadPayments();
        }
    } catch (error) {
        console.error('완료 처리 오류:', error);
        alert('완료 처리에 실패했습니다.');
    }
}

// 결제 요청 삭제
async function deletePayment(id) {
    if (!confirm('이 결제 요청을 삭제하시겠습니까?')) return;

    try {
        const response = await fetch(`${API_URL}/payments/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            alert('결제 요청이 삭제되었습니다.');
            loadPayments();
        }
    } catch (error) {
        console.error('삭제 오류:', error);
        alert('삭제에 실패했습니다.');
    }
}

// 대시보드 통계 업데이트
function updateDashboardStats() {
    const pendingCount = paymentRequests.filter(p => p.status === 'pending').length;
    const pendingAmount = paymentRequests
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.amount, 0);

    const thisMonth = new Date().getMonth();
    const monthlyAmount = paymentRequests
        .filter(p => {
            const date = new Date(p.created_at);
            return date.getMonth() === thisMonth && p.status === 'completed';
        })
        .reduce((sum, p) => sum + p.amount, 0);

    // 대시보드 업데이트
    const pendingEl = document.getElementById('pendingPayments');
    if (pendingEl) pendingEl.textContent = pendingCount;

    const monthlyEl = document.getElementById('monthlyAmount');
    if (monthlyEl) monthlyEl.textContent = formatCurrency(monthlyAmount);

    // 최근 결제 요청 표시
    displayRecentPayments();
}

// 최근 결제 요청 표시
function displayRecentPayments() {
    const container = document.getElementById('recentPayments');
    if (!container) return;

    const recent = paymentRequests
        .filter(p => p.status === 'pending')
        .slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = '<p class="text-muted">대기중인 결제 요청이 없습니다.</p>';
        return;
    }

    container.innerHTML = recent.map(payment => `
        <div style="padding: var(--spacing-md); border-bottom: 1px solid var(--color-gray-100);">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <div style="font-weight: 500;">${formatCurrency(payment.amount)}</div>
                    <div class="text-xs text-muted">${payment.description}</div>
                    <div class="text-xs text-muted">${payment.requester_name} · ${formatDate(payment.created_at)}</div>
                </div>
                <span class="payment-status ${payment.status}">${getPaymentStatusText(payment.status)}</span>
            </div>
        </div>
    `).join('');
}

// 유틸리티 함수
function formatCurrency(amount) {
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW'
    }).format(amount);
}

function getPaymentStatusText(status) {
    const statusMap = {
        'pending': '대기중',
        'approved': '승인됨',
        'completed': '완료',
        'rejected': '거절됨'
    };
    return statusMap[status] || status;
}

function getPaymentTypeText(type) {
    const typeMap = {
        'material': '자재비',
        'labor': '인건비',
        'equipment': '장비대여',
        'misc': '기타'
    };
    return typeMap[type] || type;
}

// 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
    // 필터 변경 이벤트
    document.getElementById('paymentStatusFilter')?.addEventListener('change', displayPayments);
    document.getElementById('paymentProjectFilter')?.addEventListener('change', displayPayments);
});