const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');
const coolsmsService = require('../../utils/coolsmsService'); // CoolSMS 서비스
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
    process,  // 프론트엔드에서 보내는 공정명 필드
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
    includesVAT,
    quickText,  // 자동 채우기에 사용된 원본 텍스트
    images  // 결제요청에 첨부된 이미지 배열
  } = req.body;

  // process 필드가 있으면 description으로 사용
  const finalDescription = process || description || '';

  console.log('[POST /api/payments] 필드 값 확인:');
  console.log('  - process:', process);
  console.log('  - description:', description);
  console.log('  - vendor_name:', vendor_name);
  console.log('  - itemName:', itemName);
  console.log('  - images:', images ? `${images.length}개` : 'none');

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
      material_amount, labor_amount, original_material_amount, original_labor_amount,
      apply_tax_deduction, includes_vat, quick_text, images, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      finalProjectId,
      req.user.id,
      request_type || 'material',
      vendor_name,
      finalDescription,
      amount,
      account_holder,
      bank_name,
      account_number,
      notes,
      itemName || '',
      materialAmount || 0,
      laborAmount || 0,
      originalMaterialAmount || 0,
      originalLaborAmount || 0,
      applyTaxDeduction ? 1 : 0,
      includesVAT ? 1 : 0,
      quickText || null,
      images ? JSON.stringify(images) : null
    ],
    function(err) {
      if (err) {
        console.error('[POST /api/payments] Database error:', err);
        return res.status(500).json({ error: '결제 요청 생성 실패', details: err.message });
      }

      // 알림 전송 (관리자에게) - 모든 결제요청에 대해 SMS 발송
      const paymentId = this.lastID;
      console.log('[결제요청 생성] Payment ID:', paymentId);

      sendPaymentNotification({
        id: paymentId,
        paymentId: paymentId,  // 명시적으로 paymentId 필드 추가
        requester: req.user.username,
        amount: amount,
        vendor_name: vendor_name || '',  // 공정명 (목공, 도배 등) - vendor_name이 실제 공정명
        process: process || '',
        description: finalDescription,
        project_id: finalProjectId,
        request_type: request_type || 'material',
        bank_name: bank_name,
        account_number: account_number,
        account_holder: account_holder,
        item_name: itemName || '',
        includes_vat: includesVAT,
        apply_tax_deduction: applyTaxDeduction
      });

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

  console.log('Payment update request for ID:', id);
  console.log('Request body:', req.body);

  const {
    project,
    project_id,
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
    includesVAT,
    requestDate,
    request_date
  } = req.body;

  // 날짜 처리 (requestDate 또는 request_date)
  const dateToUpdate = requestDate || request_date;

  // 프로젝트 ID 처리 (project 또는 project_id)
  const projectToUpdate = project || project_id;

  // Build SQL dynamically based on whether date should be updated
  let sql;
  let params;

  if (dateToUpdate) {
    sql = `UPDATE payment_requests
     SET project_id = ?, vendor_name = ?, description = ?, amount = ?,
         account_holder = ?, bank_name = ?, account_number = ?,
         notes = ?, item_name = ?,
         material_amount = ?, labor_amount = ?,
         original_material_amount = ?, original_labor_amount = ?,
         apply_tax_deduction = ?, includes_vat = ?,
         created_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`;
    params = [
      projectToUpdate || null,
      vendor_name || '',
      description || '',
      amount,
      account_holder || '',
      bank_name || '',
      account_number || '',
      notes || '',
      itemName || '',
      materialAmount !== undefined ? materialAmount : 0,
      laborAmount !== undefined ? laborAmount : 0,
      originalMaterialAmount !== undefined ? originalMaterialAmount : 0,
      originalLaborAmount !== undefined ? originalLaborAmount : 0,
      applyTaxDeduction ? 1 : 0,
      includesVAT ? 1 : 0,
      dateToUpdate,
      id
    ];
  } else {
    sql = `UPDATE payment_requests
     SET project_id = ?, vendor_name = ?, description = ?, amount = ?,
         account_holder = ?, bank_name = ?, account_number = ?,
         notes = ?, item_name = ?,
         material_amount = ?, labor_amount = ?,
         original_material_amount = ?, original_labor_amount = ?,
         apply_tax_deduction = ?, includes_vat = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`;
    params = [
      projectToUpdate || null,
      vendor_name || '',
      description || '',
      amount,
      account_holder || '',
      bank_name || '',
      account_number || '',
      notes || '',
      itemName || '',
      materialAmount !== undefined ? materialAmount : 0,
      laborAmount !== undefined ? laborAmount : 0,
      originalMaterialAmount !== undefined ? originalMaterialAmount : 0,
      originalLaborAmount !== undefined ? originalLaborAmount : 0,
      applyTaxDeduction ? 1 : 0,
      includesVAT ? 1 : 0,
      id
    ];
  }

  db.run(sql, params,
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

// 결제 요청 금액만 업데이트 (자재비/인건비 분할용)
router.patch('/:id/amounts', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { materialAmount, laborAmount } = req.body;

  console.log(`[PATCH /api/payments/:id/amounts] Updating payment ${id} amounts:`, { materialAmount, laborAmount });

  db.run(
    `UPDATE payment_requests
     SET material_amount = ?,
         labor_amount = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      materialAmount !== undefined ? materialAmount : 0,
      laborAmount !== undefined ? laborAmount : 0,
      id
    ],
    function(err) {
      if (err) {
        console.error('[PATCH /api/payments/:id/amounts] Database error:', err);
        return res.status(500).json({ error: '금액 수정 실패', details: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '결제 요청을 찾을 수 없습니다.' });
      }

      console.log(`[PATCH /api/payments/:id/amounts] Successfully updated payment ${id}`);
      res.json({ message: '금액이 수정되었습니다.' });
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

// 알림 전송 함수들 - CoolSMS 문자 발송
async function sendPaymentNotification(data) {
  console.log(`새 결제 요청: ${data.requester}님이 ${data.amount.toLocaleString()}원 요청`);

  // 부가세/세금공제 둘 다 미체크인 경우 기존 번호로는 발송하지 않음
  // (프론트엔드에서 01089423283으로 별도 발송)
  if (!data.includes_vat && !data.apply_tax_deduction) {
    console.log('[CoolSMS] 부가세/세금공제 미체크 - 기존 번호로 발송 생략 (별도 번호로 발송됨)');
    return;
  }

  try {
    // 프로젝트 정보 조회
    const project = await new Promise((resolve, reject) => {
      db.get('SELECT name FROM projects WHERE id = ?', [data.project_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log('[CoolSMS] 프로젝트 조회 결과:', project);
    console.log('[CoolSMS] 결제 요청 데이터:', {
      project_id: data.project_id,
      amount: data.amount,
      account_holder: data.account_holder,
      bank_name: data.bank_name,
      account_number: data.account_number
    });

    // CoolSMS 문자 발송 데이터
    const notificationData = {
      paymentId: data.paymentId || data.id,  // 송금완료 링크를 위한 payment ID
      id: data.id || data.paymentId,
      projectName: project?.name || '프로젝트',
      amount: data.amount,
      accountHolder: data.account_holder || '',
      bankName: data.bank_name || '',
      accountNumber: data.account_number || '',
      requesterName: data.requester,
      itemName: data.item_name || '',
      purpose: data.vendor_name || data.process || data.description || '',  // vendor_name이 공정명 (목공, 도배 등)
      category: data.request_type || 'material',
      includesVat: data.includes_vat,
      applyTaxDeduction: data.apply_tax_deduction
    };

    console.log('[CoolSMS] 문자 발송 데이터:', notificationData);
    console.log('[DEBUG] request_type 원본값:', data.request_type);

    // CoolSMS로 문자 발송
    try {
      const results = await coolsmsService.sendPaymentNotification(notificationData);
      console.log('✅ CoolSMS 발송 결과:', results);
    } catch (coolsmsError) {
      console.error('❌ CoolSMS 문자 발송 실패:', coolsmsError.message);
    }
  } catch (error) {
    console.error('❌ 결제 알림 발송 실패:', error);
    // 에러가 발생해도 결제 요청 처리는 계속 진행
  }
}

async function notifyApproval(requestId, status) {
  console.log(`결제 요청 #${requestId}이 ${status === 'approved' ? '승인' : '거절'}되었습니다.`);

  // 현재는 카카오톡 알림 대신 콘솔 로그만 출력
  // 추후 필요시 SMS 또는 이메일 알림 추가 가능
}

async function notifyCompletion(requestId) {
  console.log(`결제 요청 #${requestId}의 결제가 완료되었습니다.`);

  // 현재는 카카오톡 알림 대신 콘솔 로그만 출력
  // 추후 필요시 SMS 또는 이메일 알림 추가 가능
}

// 토스페이먼츠 서비스
const tossTransfer = require('../utils/toss-transfer');

// 토스페이 송금 서비스
const tosspayTransfer = require('../utils/tosspay-transfer');

// 토스페이먼츠 즉시송금 요청
router.post('/toss/instant-transfer', authenticateToken, isManager, async (req, res) => {
  try {
    const { paymentId, receiverName, receiverBank, receiverAccount, amount, description } = req.body;

    console.log('[POST /api/payments/toss/instant-transfer] 송금 요청:', {
      paymentId,
      receiverName,
      amount
    });

    // 필수 정보 확인
    if (!receiverName || !receiverBank || !receiverAccount || !amount) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    // 은행 코드 변환
    const bankCode = tossTransfer.getBankCode(receiverBank);
    if (!bankCode) {
      return res.status(400).json({
        success: false,
        error: `지원하지 않는 은행입니다: ${receiverBank}`
      });
    }

    // 고유한 주문 ID 생성
    const orderId = `PAYMENT_${paymentId}_${Date.now()}`;

    // 토스페이먼츠 이체 API 호출
    const result = await tossTransfer.requestTransfer({
      orderId: orderId,
      orderName: description || `결제요청 송금`,
      amount: amount,
      customerName: receiverName,
      bankCode: bankCode,
      accountNumber: receiverAccount,
      successUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/payments/toss/success?paymentId=${paymentId}`,
      failUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/payments/toss/fail?paymentId=${paymentId}`
    });

    if (result.success) {
      // 이체 정보를 데이터베이스에 저장
      db.run(
        'UPDATE payment_requests SET toss_payment_key = ?, toss_order_id = ? WHERE id = ?',
        [result.paymentKey, result.orderId, paymentId],
        (err) => {
          if (err) {
            console.error('이체 정보 저장 실패:', err);
          }
        }
      );

      res.json({
        success: true,
        paymentKey: result.paymentKey,
        orderId: result.orderId,
        checkoutUrl: result.checkoutUrl,
        message: '이체 요청이 생성되었습니다'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        errorCode: result.errorCode
      });
    }

  } catch (error) {
    console.error('[POST /api/payments/toss/instant-transfer] 오류:', error);
    res.status(500).json({
      success: false,
      error: '송금 요청 처리 중 오류가 발생했습니다.'
    });
  }
});

// 토스페이먼츠 성공 콜백
router.get('/toss/success', async (req, res) => {
  try {
    const { paymentKey, orderId, amount, paymentId } = req.query;

    // 이체 승인
    const result = await tossTransfer.confirmTransfer(paymentKey, orderId, parseInt(amount));

    if (result.success) {
      // 결제 요청 상태 업데이트
      db.run(
        'UPDATE payment_requests SET status = ?, paid_at = ? WHERE id = ?',
        ['completed', new Date().toISOString(), paymentId],
        (err) => {
          if (err) {
            console.error('결제 요청 상태 업데이트 실패:', err);
          }
        }
      );

      res.redirect('/payments?status=success&message=' + encodeURIComponent('송금이 완료되었습니다'));
    } else {
      res.redirect('/payments?status=error&message=' + encodeURIComponent(result.error));
    }
  } catch (error) {
    console.error('토스페이먼츠 성공 콜백 오류:', error);
    res.redirect('/payments?status=error&message=' + encodeURIComponent('송금 처리 중 오류가 발생했습니다'));
  }
});

// 토스페이먼츠 실패 콜백
router.get('/toss/fail', (req, res) => {
  const { message } = req.query;
  res.redirect('/payments?status=fail&message=' + encodeURIComponent(message || '송금이 취소되었습니다'));
});

// ==================== 토스페이 즉시송금 ====================

// 토스페이 즉시송금 요청
router.post('/tosspay/instant-transfer', authenticateToken, isManager, async (req, res) => {
  try {
    const { paymentId, receiverName, receiverBank, receiverAccount, amount, description } = req.body;

    console.log('[POST /api/payments/tosspay/instant-transfer] 송금 요청:', {
      paymentId,
      receiverName,
      receiverBank,
      receiverAccount,
      amount
    });

    // 필수 정보 확인
    if (!receiverName || !receiverBank || !receiverAccount || !amount) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    // 토스페이 송금 API 호출
    const result = await tosspayTransfer.sendMoney({
      receiverName: receiverName,
      receiverBank: receiverBank,
      receiverAccount: receiverAccount,
      amount: amount,
      description: description || `결제요청 송금`
    });

    if (result.success) {
      // 송금 정보를 데이터베이스에 저장
      db.run(
        `UPDATE payment_requests
         SET status = ?,
             paid_at = ?,
             tosspay_transfer_id = ?
         WHERE id = ?`,
        ['completed', new Date().toISOString(), result.transferId, paymentId],
        (err) => {
          if (err) {
            console.error('송금 정보 저장 실패:', err);
          }
        }
      );

      res.json({
        success: true,
        transferId: result.transferId,
        message: '송금이 완료되었습니다'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        errorCode: result.errorCode
      });
    }

  } catch (error) {
    console.error('[POST /api/payments/tosspay/instant-transfer] 오류:', error);
    res.status(500).json({
      success: false,
      error: '송금 요청 처리 중 오류가 발생했습니다.'
    });
  }
});

// 토스페이 송금 조회
router.get('/tosspay/transfer/:transferId', authenticateToken, async (req, res) => {
  try {
    const { transferId } = req.params;

    const result = await tosspayTransfer.getTransferStatus(transferId);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('토스페이 송금 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '송금 조회 중 오류가 발생했습니다.'
    });
  }
});

// 토스페이 송금 한도 조회
router.get('/tosspay/limit', authenticateToken, isManager, async (req, res) => {
  try {
    const result = await tosspayTransfer.getTransferLimit();

    if (result.success) {
      res.json({
        success: true,
        dailyLimit: result.dailyLimit,
        remainingLimit: result.remainingLimit,
        usedAmount: result.usedAmount
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('토스페이 한도 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '한도 조회 중 오류가 발생했습니다.'
    });
  }
});

// ==================== 토스 송금 SMS 발송 (부가세/세금공제 미체크용) ====================

// 토스 송금 SMS 발송 (특정 번호로)
router.post('/send-toss-payment-sms', authenticateToken, async (req, res) => {
  try {
    const { recipientPhone, accountHolder, bankName, accountNumber, amount, projectName, itemName } = req.body;

    console.log('[POST /api/payments/send-toss-payment-sms] SMS 발송 요청:', {
      recipientPhone,
      accountHolder,
      bankName,
      accountNumber,
      amount,
      projectName,
      itemName
    });

    // 필수 정보 확인
    if (!recipientPhone || !accountHolder || !bankName || !accountNumber || !amount) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    // 프로젝트명에서 앞 2글자 추출
    const projectPrefix = (projectName || '프로젝트').substring(0, 2);

    // 토스 딥링크 생성
    const cleanAccountNumber = accountNumber.replace(/-/g, '');
    const tossBankName = coolsmsService.convertToTossBankName(bankName);
    const bankCode = coolsmsService.getBankCode(bankName);
    const tossDeeplink = `supertoss://send?amount=${amount}&bankCode=${bankCode}&bank=${encodeURIComponent(tossBankName)}&accountNo=${cleanAccountNumber}`;

    // 금액 포맷팅
    const formattedAmount = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // SMS 메시지 생성
    let message = `${projectPrefix}/${itemName || '결제요청'}\n`;
    message += `${bankName} ${accountNumber} ${accountHolder}\n`;
    message += `${formattedAmount}원\n\n`;
    message += `토스송금:\n${tossDeeplink}`;

    console.log('[토스 SMS] 발송할 메시지:', message);

    // SMS 발송
    const result = await coolsmsService.sendSMS(recipientPhone, message, ' ');

    if (result.success) {
      console.log('[토스 SMS] 발송 성공:', result.response);
      res.json({
        success: true,
        message: '토스 송금 SMS가 발송되었습니다.'
      });
    } else {
      console.error('[토스 SMS] 발송 실패:', result.error);
      res.status(400).json({
        success: false,
        error: result.error || 'SMS 발송에 실패했습니다.'
      });
    }

  } catch (error) {
    console.error('[POST /api/payments/send-toss-payment-sms] 오류:', error);
    res.status(500).json({
      success: false,
      error: 'SMS 발송 처리 중 오류가 발생했습니다.'
    });
  }
});

// ==================== 오픈뱅킹 즉시송금 ====================

// 오픈뱅킹 즉시송금 요청
router.post('/openbanking/instant-transfer', authenticateToken, isManager, async (req, res) => {
  try {
    const { paymentId, receiverName, receiverBank, receiverAccount, amount, description } = req.body;

    console.log('[POST /api/payments/openbanking/instant-transfer] 송금 요청:', {
      paymentId,
      receiverName,
      receiverBank,
      receiverAccount,
      amount
    });

    // 필수 정보 확인
    if (!receiverName || !receiverBank || !receiverAccount || !amount) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    // 은행 코드 매핑
    const bankCodeMap = {
      'KB국민은행': '004',
      '신한은행': '088',
      '우리은행': '020',
      '하나은행': '081',
      'NH농협은행': '011',
      '기업은행': '003',
      'SC제일은행': '023',
      '씨티은행': '027',
      '새마을금고': '045',
      '대구은행': '031',
      '부산은행': '032',
      '경남은행': '039',
      '광주은행': '034',
      '전북은행': '037',
      '제주은행': '035',
      '카카오뱅크': '090',
      '케이뱅크': '089',
      '토스뱅크': '092',
    };

    const bankCode = bankCodeMap[receiverBank];
    if (!bankCode) {
      return res.status(400).json({
        success: false,
        error: `지원하지 않는 은행입니다: ${receiverBank}. 토스 앱을 통한 송금을 이용해주세요.`
      });
    }

    // 계좌번호에서 하이픈 제거
    const cleanAccountNumber = receiverAccount.replace(/-/g, '');

    // 오픈뱅킹 API 설정 확인
    const companyFintechUseNum = process.env.COMPANY_FINTECH_USE_NUM;
    const institutionCode = process.env.OPENBANKING_INSTITUTION_CODE;

    // 오픈뱅킹 토큰 조회 (데이터베이스에서)
    const token = await new Promise((resolve, reject) => {
      db.get(
        'SELECT access_token FROM kb_banking_tokens WHERE id = 1 AND expires_at > datetime("now") ORDER BY created_at DESC LIMIT 1',
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!token || !companyFintechUseNum || !institutionCode) {
      // 오픈뱅킹 API가 설정되지 않은 경우
      return res.status(503).json({
        success: false,
        error: '오픈뱅킹 API가 설정되지 않았습니다. 관리자에게 오픈뱅킹 연동을 요청해주세요.',
        fallbackToManual: true
      });
    }

    // 거래고유번호 생성 (기관코드 + U + 날짜시간 + 일련번호, 최대 20자리)
    const timestamp = Date.now().toString();
    const random = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    const bankTranId = `${institutionCode}U${timestamp}${random}`.substring(0, 20);

    // 요청일시 (YYYYMMDDhhmmss)
    const now = new Date();
    const tranDtime = now.getFullYear().toString() +
                     (now.getMonth() + 1).toString().padStart(2, '0') +
                     now.getDate().toString().padStart(2, '0') +
                     now.getHours().toString().padStart(2, '0') +
                     now.getMinutes().toString().padStart(2, '0') +
                     now.getSeconds().toString().padStart(2, '0');

    // 오픈뱅킹 입금이체 API 호출 (계좌번호 사용)
    const apiUrl = process.env.OPENBANKING_API_URL || 'https://openapi.openbanking.or.kr';
    console.log('[오픈뱅킹] API 호출 시작:', {
      url: `${apiUrl}/v2.0/transfer/deposit/acnt_num`,
      bankTranId,
      receiverBank: bankCode,
      receiverAccount: cleanAccountNumber,
      amount
    });

    const openBankingResponse = await fetch(`${apiUrl}/v2.0/transfer/deposit/acnt_num`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': `Bearer ${token.access_token}`
      },
      body: JSON.stringify({
        bank_tran_id: bankTranId,
        cntr_account_type: 'N',
        cntr_account_num: process.env.COMPANY_ACCOUNT_NO || '',
        dps_print_content: (description || `${receiverName}님 송금`).substring(0, 16),
        fintech_use_num: companyFintechUseNum,
        wd_print_content: (description || '송금').substring(0, 16),
        tran_amt: String(amount),
        tran_dtime: tranDtime,
        req_client_name: receiverName,
        req_client_num: String(paymentId),
        transfer_purpose: 'TR',
        recv_client_name: receiverName,
        recv_client_bank_code: bankCode,
        recv_client_account_num: cleanAccountNumber
      })
    });

    const openbankingResult = await openBankingResponse.json();

    console.log('[오픈뱅킹] API 응답:', {
      rsp_code: openbankingResult.rsp_code,
      rsp_message: openbankingResult.rsp_message,
      api_tran_id: openbankingResult.api_tran_id,
      api_tran_dtm: openbankingResult.api_tran_dtm,
      tran_amt: openbankingResult.tran_amt
    });

    if (openbankingResult.rsp_code === 'A0000' && openbankingResult.api_tran_id) {
      // 송금 성공
      console.log('[오픈뱅킹] 송금 성공:', {
        api_tran_id: openbankingResult.api_tran_id,
        tran_amt: openbankingResult.tran_amt,
        wd_bank_code_name: openbankingResult.wd_bank_code_name
      });

      db.run(
        `UPDATE payment_requests
         SET status = ?,
             paid_at = ?,
             openbanking_tran_id = ?
         WHERE id = ?`,
        ['completed', new Date().toISOString(), openbankingResult.api_tran_id, paymentId],
        (err) => {
          if (err) {
            console.error('송금 정보 저장 실패:', err);
          } else {
            console.log(`[오픈뱅킹] 결제 요청 ${paymentId} 상태 업데이트 완료`);
          }
        }
      );

      res.json({
        success: true,
        tranId: openbankingResult.api_tran_id,
        message: '송금이 완료되었습니다'
      });
    } else {
      // 송금 실패
      console.error('[오픈뱅킹] 송금 실패:', {
        rsp_code: openbankingResult.rsp_code,
        rsp_message: openbankingResult.rsp_message,
        bank_tran_id: bankTranId,
        receiverBank: bankCode,
        receiverAccount: cleanAccountNumber,
        amount
      });

      res.status(400).json({
        success: false,
        error: openbankingResult.rsp_message || '송금에 실패했습니다',
        errorCode: openbankingResult.rsp_code,
        fallbackToManual: true
      });
    }

  } catch (error) {
    console.error('[POST /api/payments/openbanking/instant-transfer] 오류:', error);
    res.status(500).json({
      success: false,
      error: '송금 요청 처리 중 오류가 발생했습니다.',
      fallbackToManual: true
    });
  }
});

module.exports = router;