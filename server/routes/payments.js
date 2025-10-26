const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');
const solapiService = require('../../utils/solapiService'); // SOLAPI 서비스로 변경
const { sanitizeDatesArray, sanitizeDates } = require('../utils/dateUtils');

// 결제 요청 목록 조회
router.get('/', authenticateToken, (req, res) => {
  console.log('[GET /api/payments] Request received');
  const { status, project_id, user_id } = req.query;
  let query = `
    SELECT pr.*,
           u.username as requester_name,
           p.name as project_name,
           p.color as project_color,
           a.username as approver_name
    FROM payment_requests pr
    LEFT JOIN users u ON pr.user_id = u.id
    LEFT JOIN projects p ON pr.project_id = p.id
    LEFT JOIN users a ON pr.approved_by = a.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND pr.status = ?';
    params.push(status);
  }
  if (project_id) {
    query += ' AND pr.project_id = ?';
    params.push(project_id);
  }
  if (user_id) {
    query += ' AND pr.user_id = ?';
    params.push(user_id);
  }

  query += ' ORDER BY pr.created_at DESC';

  db.all(query, params, (err, requests) => {
    if (err) {
      console.error('[GET /api/payments] Database error:', err);
      return res.status(500).json({ error: '결제 요청 조회 실패' });
    }
    console.log('[GET /api/payments] Found', requests.length, 'payments');
    console.log('[GET /api/payments] Sample:', JSON.stringify(requests[0], null, 2));
    // Convert SQLite dates to ISO 8601
    const sanitized = sanitizeDatesArray(requests, ['created_at', 'updated_at', 'approved_at', 'paid_at']);
    res.json(sanitized);
  });
});

// 특정 결제 요청 조회
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT pr.*,
            u.username as requester_name,
            p.name as project_name,
            p.color as project_color,
            a.username as approver_name
     FROM payment_requests pr
     LEFT JOIN users u ON pr.user_id = u.id
     LEFT JOIN projects p ON pr.project_id = p.id
     LEFT JOIN users a ON pr.approved_by = a.id
     WHERE pr.id = ?`,
    [id],
    (err, request) => {
      if (err) {
        return res.status(500).json({ error: '결제 요청 조회 실패' });
      }
      if (!request) {
        return res.status(404).json({ error: '결제 요청을 찾을 수 없습니다.' });
      }
      res.json(request);
    }
  );
});

// 결제 요청 생성
router.post('/', authenticateToken, async (req, res) => {
  console.log('[POST /api/payments] Received request body:', req.body);
  console.log('[POST /api/payments] User:', req.user);

  const {
    project_id,
    request_type,
    vendor_name,
    description,
    amount,
    account_holder,
    bank_name,
    account_number,
    notes,
    itemName,
    materialAmount,
    laborAmount,
    originalLaborAmount,
    applyTaxDeduction,
    includesVAT
  } = req.body;

  // Convert project name to project_id if necessary
  let finalProjectId = project_id;

  // First, try to parse as a number if it looks like a number
  if (project_id && !isNaN(project_id)) {
    // It's a numeric string or number, ensure it's a number
    finalProjectId = Number(project_id);
    console.log('[POST /api/payments] Using numeric project_id:', finalProjectId);
  } else if (project_id) {
    // It's a non-numeric string, try to look up by name
    console.log('[POST /api/payments] project_id is a name, looking up ID for:', project_id);

    // Look up project by name
    const project = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM projects WHERE name = ?', [project_id], (err, row) => {
        if (err) {
          console.error('[POST /api/payments] Project lookup error:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    }).catch(err => {
      console.error('[POST /api/payments] Project lookup failed:', err);
      return null;
    });

    if (!project) {
      console.error('[POST /api/payments] Project not found by name:', project_id);
      return res.status(400).json({ error: '프로젝트를 찾을 수 없습니다: ' + project_id });
    }

    finalProjectId = project.id;
    console.log('[POST /api/payments] Found project ID:', finalProjectId);
  }

  // Check if project exists by ID
  if (!finalProjectId) {
    console.error('[POST /api/payments] No valid project_id provided');
    return res.status(400).json({ error: '프로젝트 ID가 필요합니다' });
  }

  db.run(
    `INSERT INTO payment_requests
     (project_id, user_id, request_type, vendor_name, description, amount,
      account_holder, bank_name, account_number, notes, item_name,
      material_amount, labor_amount, original_labor_amount, apply_tax_deduction, includes_vat, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      finalProjectId,
      req.user.id,
      request_type || 'material',
      vendor_name,
      description || '',
      amount,
      account_holder,
      bank_name,
      account_number,
      notes,
      itemName || '',
      materialAmount || 0,
      laborAmount || 0,
      originalLaborAmount || 0,
      applyTaxDeduction ? 1 : 0,
      includesVAT ? 1 : 0
    ],
    function(err) {
      if (err) {
        console.error('[POST /api/payments] Database error:', err);
        return res.status(500).json({ error: '결제 요청 생성 실패', details: err.message });
      }

      // 긴급 여부 확인 (프론트엔드에서 urgency 필드 또는 includesVAT로 판단)
      const isUrgent = req.body.urgency === 'urgent' || req.body.urgency === 'emergency';

      // 알림 전송 (관리자에게)
      sendPaymentNotification({
        id: this.lastID,
        requester: req.user.username,
        amount: amount,
        description: description,
        project_id: finalProjectId,
        request_type: request_type || 'material',
        bank_name: bank_name,
        account_number: account_number,
        account_holder: account_holder,
        item_name: itemName || ''
      }, isUrgent);

      res.status(201).json({
        id: this.lastID,
        message: '결제 요청이 생성되었습니다.'
      });
    }
  );
});

// 결제 요청 수정
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const {
    vendor_name,
    description,
    amount,
    account_holder,
    bank_name,
    account_number,
    notes,
    itemName,
    materialAmount,
    laborAmount,
    originalMaterialAmount,
    originalLaborAmount,
    applyTaxDeduction,
    includesVAT
  } = req.body;

  db.run(
    `UPDATE payment_requests
     SET vendor_name = ?, description = ?, amount = ?,
         account_holder = ?, bank_name = ?, account_number = ?,
         notes = ?, item_name = ?,
         material_amount = ?, labor_amount = ?,
         original_material_amount = ?, original_labor_amount = ?,
         apply_tax_deduction = ?, includes_vat = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      vendor_name,
      description,
      amount,
      account_holder,
      bank_name,
      account_number,
      notes,
      itemName || '',
      materialAmount !== undefined ? materialAmount : 0,
      laborAmount !== undefined ? laborAmount : 0,
      originalMaterialAmount !== undefined ? originalMaterialAmount : 0,
      originalLaborAmount !== undefined ? originalLaborAmount : 0,
      applyTaxDeduction ? 1 : 0,
      includesVAT ? 1 : 0,
      id
    ],
    function(err) {
      if (err) {
        console.error('Payment update error:', err);
        return res.status(500).json({
          error: '결제 요청 수정 실패',
          details: err.message,
          sql: err.sql
        });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '수정할 수 없는 요청입니다.' });
      }

      // 송금완료된 경우 실행내역도 함께 업데이트
      db.get('SELECT status FROM payment_requests WHERE id = ?', [id], (err, payment) => {
        if (!err && payment && payment.status === 'completed') {
          // 실행내역 업데이트
          db.run(
            `UPDATE execution_records
             SET project_name = (SELECT name FROM projects WHERE id =
                                (SELECT project_id FROM payment_requests WHERE id = ?)),
                 amount = ?,
                 material_cost = ?,
                 labor_cost = ?,
                 notes = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE payment_id = ?`,
            [
              id,
              amount,
              materialAmount !== undefined ? materialAmount : 0,
              laborAmount !== undefined ? laborAmount : 0,
              notes || '',
              id
            ],
            (updateErr) => {
              if (updateErr) {
                console.error('실행내역 업데이트 실패:', updateErr);
              } else {
                console.log('실행내역도 함께 업데이트됨');
              }
            }
          );
        }
      });

      res.json({ message: '결제 요청이 수정되었습니다.' });
    }
  );
});

// 결제 승인
router.post('/:id/approve', authenticateToken, isManager, (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE payment_requests
     SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'pending'`,
    [req.user.id, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '승인 처리 실패' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '승인할 수 없는 요청입니다.' });
      }

      // 요청자에게 알림 전송
      notifyApproval(id, 'approved');

      res.json({ message: '결제 요청이 승인되었습니다.' });
    }
  );
});

// 결제 거절
router.post('/:id/reject', authenticateToken, isManager, (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  db.run(
    `UPDATE payment_requests
     SET status = 'rejected', notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'pending'`,
    [reason, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '거절 처리 실패' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '거절할 수 없는 요청입니다.' });
      }

      // 요청자에게 알림 전송
      notifyApproval(id, 'rejected');

      res.json({ message: '결제 요청이 거절되었습니다.' });
    }
  );
});

// 결제 상태 변경 (송금완료 등)
router.put('/:id/status', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  console.log(`[PUT /api/payments/:id/status] Updating payment ${id} to status: ${status}`);

  // 유효한 상태값 검증
  const validStatuses = ['pending', 'reviewing', 'approved', 'rejected', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: '유효하지 않은 상태값입니다.' });
  }

  db.run(
    `UPDATE payment_requests
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, id],
    function(err) {
      if (err) {
        console.error('[PUT /api/payments/:id/status] Database error:', err);
        return res.status(500).json({ error: '상태 변경 실패' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '결제 요청을 찾을 수 없습니다.' });
      }

      console.log(`[PUT /api/payments/:id/status] Successfully updated payment ${id} to ${status}`);

      // 상태가 completed로 변경되면 paid_at 업데이트
      if (status === 'completed') {
        db.run(
          'UPDATE payment_requests SET paid_at = CURRENT_TIMESTAMP WHERE id = ?',
          [id],
          (err) => {
            if (err) console.error('Error updating paid_at:', err);
          }
        );
        notifyCompletion(id);
      }

      res.json({ message: '상태가 변경되었습니다.' });
    }
  );
});

// 결제 완료 처리
router.post('/:id/complete', authenticateToken, isManager, (req, res) => {
  const { id } = req.params;
  const { receipt_url } = req.body;

  db.run(
    `UPDATE payment_requests
     SET status = 'completed', paid_at = CURRENT_TIMESTAMP,
         receipt_url = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'approved'`,
    [receipt_url, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '완료 처리 실패' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '완료 처리할 수 없는 요청입니다.' });
      }

      // 요청자에게 알림 전송
      notifyCompletion(id);

      res.json({ message: '결제가 완료되었습니다.' });
    }
  );
});

// 결제 요청 삭제
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  // 모든 상태의 결제 요청 삭제 가능
  db.run(
    `DELETE FROM payment_requests
     WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        console.error('[DELETE /api/payments/:id] Database error:', err);
        return res.status(500).json({ error: '삭제 실패' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '삭제할 수 없는 요청입니다. (이미 삭제되었거나 존재하지 않습니다)' });
      }
      console.log(`[DELETE /api/payments/:id] Deleted payment request ${id} by user ${req.user.id}`);
      res.json({ message: '결제 요청이 삭제되었습니다.' });
    }
  );
});

// 결제 요청 통계
router.get('/stats/summary', authenticateToken, (req, res) => {
  db.get(
    `SELECT
       COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
       COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
       COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
       SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
       SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_amount
     FROM payment_requests`,
    [],
    (err, stats) => {
      if (err) {
        return res.status(500).json({ error: '통계 조회 실패' });
      }
      res.json(stats);
    }
  );
});

// 알림 전송 함수들 - SOLAPI 알림톡 연동
async function sendPaymentNotification(data, isUrgent = false) {
  console.log(`새 결제 요청: ${data.requester}님이 ${data.amount.toLocaleString()}원 요청${isUrgent ? ' [긴급]' : ''}`);

  try {
    // 프로젝트 정보 조회
    const project = await new Promise((resolve, reject) => {
      db.get('SELECT name FROM projects WHERE id = ?', [data.project_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log('[SOLAPI] 프로젝트 조회 결과:', project);
    console.log('[SOLAPI] 결제 요청 데이터:', {
      project_id: data.project_id,
      amount: data.amount,
      account_holder: data.account_holder,
      bank_name: data.bank_name,
      account_number: data.account_number
    });

    // SOLAPI 알림톡 발송
    const notificationData = {
      projectName: project?.name || '프로젝트',
      amount: data.amount,
      accountHolder: data.account_holder || '',
      bankName: data.bank_name || '',
      accountNumber: data.account_number || '',
      requesterName: data.requester,
      itemName: data.item_name || '',
      purpose: data.description || '',
      category: data.request_type || '자재비'
    };

    console.log('[SOLAPI] 알림톡 발송 데이터:', notificationData);

    // SOLAPI로 알림톡 발송 (긴급인 경우 SMS도 추가 발송)
    const results = await solapiService.sendPaymentNotification(notificationData, isUrgent);
    console.log('SOLAPI 알림 발송 결과:', results);
  } catch (error) {
    console.error('SOLAPI 알림 발송 실패:', error);
    // 에러가 발생해도 결제 요청 처리는 계속 진행
  }
}

async function notifyApproval(requestId, status) {
  console.log(`결제 요청 #${requestId}이 ${status === 'approved' ? '승인' : '거절'}되었습니다.`);

  try {
    // 결제 요청 정보 조회
    const request = await new Promise((resolve, reject) => {
      db.get(
        `SELECT pr.*, u.username as requester_name, a.username as approver_name
         FROM payment_requests pr
         LEFT JOIN users u ON pr.user_id = u.id
         LEFT JOIN users a ON pr.approved_by = a.id
         WHERE pr.id = ?`,
        [requestId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!request) return;

    // 승인 메시지 생성
    if (status === 'approved') {
      const message = kakaoMessage.createPaymentApprovalMessage({
        requesterName: request.requester_name,
        amount: request.amount,
        approverName: request.approver_name,
        approvalTime: new Date()
      });

      // 요청자에게 메시지 발송 (요청자의 토큰이 있는 경우)
      // 실제 서비스에서는 요청자의 user_id로 토큰을 조회하여 발송
      if (kakaoMessage.tokenStore.has(`user_${request.user_id}`)) {
        await kakaoMessage.sendToMe(
          kakaoMessage.tokenStore.get(`user_${request.user_id}`).accessToken,
          message
        );
      }
    }
  } catch (error) {
    console.error('승인 알림 발송 실패:', error);
  }
}

async function notifyCompletion(requestId) {
  console.log(`결제 요청 #${requestId}의 결제가 완료되었습니다.`);

  try {
    // 결제 요청 정보 조회
    const request = await new Promise((resolve, reject) => {
      db.get(
        `SELECT pr.*, u.username as requester_name
         FROM payment_requests pr
         LEFT JOIN users u ON pr.user_id = u.id
         WHERE pr.id = ?`,
        [requestId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!request) return;

    // 완료 메시지 생성
    const message = kakaoMessage.createPaymentCompleteMessage({
      requesterName: request.requester_name,
      amount: request.amount,
      completeTime: new Date()
    });

    // 요청자에게 메시지 발송
    if (kakaoMessage.tokenStore.has(`user_${request.user_id}`)) {
      await kakaoMessage.sendToMe(
        kakaoMessage.tokenStore.get(`user_${request.user_id}`).accessToken,
        message
      );
    }
  } catch (error) {
    console.error('완료 알림 발송 실패:', error);
  }
}

module.exports = router;