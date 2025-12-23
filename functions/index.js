const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Firebase Admin 초기화
admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

// JWT Secret (Railway와 동일하게 설정)
const JWT_SECRET = process.env.JWT_SECRET || '07ba7a6310c790f94a42d8b649f424ece80074eb24579e647ca3db80b7234bf3';

// Admin 설정
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'hvlab-admin-secret-2024';
const ADMIN_PHONE_NUMBERS = (process.env.ADMIN_PHONE_NUMBERS || '01074088864,01089423283').split(',');

// CoolSMS/Solapi 설정
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || 'NCSAOUKZWBK9ISKK';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || 'OUETIQGRMUWMWYYU4KKJMCROBLPMSNMB';
const SOLAPI_FROM_NUMBER = process.env.SOLAPI_FROM_NUMBER || '01074088864';
const SOLAPI_PFID = process.env.SOLAPI_PFID || 'KA01PF251010200623410stJ4ZpKzQLv';
const SOLAPI_TEMPLATE_ID = process.env.SOLAPI_TEMPLATE_ID || 'KA01TP2510102016192182Rh5igl5PtG';

// Express 앱 생성
const app = express();

// CORS 설정
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50mb' }));

// =====================
// 인증 미들웨어
// =====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }
    req.user = user;
    next();
  });
};

// =====================
// Health Check
// =====================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: 'firebase-functions',
    version: '2.0.0',
    service: 'HV LAB Interior Management API (Firebase)'
  });
});

// =====================
// Auth Routes
// =====================

// 로그인
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt for username:', username);

    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();

    console.log('Query result - empty:', snapshot.empty, 'size:', snapshot.size);

    if (snapshot.empty) {
      // 전체 사용자 목록 조회 시도
      const allUsers = await usersRef.get();
      console.log('Total users in DB:', allUsers.size);
      allUsers.forEach(doc => {
        console.log('User:', doc.id, doc.data().username);
      });
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const userDoc = snapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };
    console.log('Found user:', user.username);

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '서버 오류: ' + error.message });
  }
});

// 토큰 검증
app.get('/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ valid: false });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ valid: false });
    res.json({ valid: true, user });
  });
});

// 현재 로그인 사용자 정보
app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.id).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = userDoc.data();
    res.json({
      success: true,
      user: {
        id: userDoc.id,
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department,
        phone: user.phone,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// =====================
// Users Routes
// =====================
app.get('/users', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = [];
    snapshot.forEach(doc => {
      const user = doc.data();
      users.push({
        id: doc.id,
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department
      });
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: '사용자 목록 조회 실패' });
  }
});

// =====================
// Projects Routes
// =====================
app.get('/projects', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = db.collection('projects');

    const snapshot = await query.get();
    let projects = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!status || data.status === status) {
        projects.push({ _id: doc.id, ...data });
      }
    });

    // Sort by created_at desc
    projects.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at._seconds * 1000 || a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at._seconds * 1000 || b.created_at) : new Date(0);
      return dateB - dateA;
    });

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: '프로젝트 조회 실패' });
  }
});

app.get('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await db.collection('projects').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: '프로젝트 조회 실패' });
  }
});

app.post('/projects', authenticateToken, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const projectData = {
      name: req.body.name,
      client: req.body.client || '',
      address: req.body.address || '',
      start_date: req.body.start_date || req.body.startDate || null,
      end_date: req.body.end_date || req.body.endDate || null,
      status: req.body.status || 'planning',
      color: req.body.color || '#4A90E2',
      description: req.body.description || '',
      manager_name: req.body.manager || null,
      manager_id: req.user.id,
      created_by: req.user.id,
      created_by_name: req.user.username,
      created_at: now,
      updated_at: now
    };

    const docRef = await db.collection('projects').add(projectData);
    res.status(201).json({ id: docRef.id, ...projectData });
  } catch (error) {
    res.status(500).json({ error: '프로젝트 생성 실패' });
  }
});

app.put('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const updates = { updated_at: admin.firestore.FieldValue.serverTimestamp() };

    const fieldMap = {
      name: 'name', client: 'client', address: 'address',
      startDate: 'start_date', start_date: 'start_date',
      endDate: 'end_date', end_date: 'end_date',
      status: 'status', color: 'color', description: 'description',
      manager: 'manager_name'
    };

    for (const [key, field] of Object.entries(fieldMap)) {
      if (req.body[key] !== undefined) updates[field] = req.body[key];
    }

    await db.collection('projects').doc(req.params.id).update(updates);
    const doc = await db.collection('projects').doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: '프로젝트 수정 실패' });
  }
});

app.delete('/projects/:id', authenticateToken, async (req, res) => {
  try {
    await db.collection('projects').doc(req.params.id).delete();
    res.json({ message: '프로젝트가 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '프로젝트 삭제 실패' });
  }
});

// =====================
// Schedules Routes
// =====================
app.get('/schedules', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('schedules').get();
    const schedules = [];

    for (const doc of snapshot.docs) {
      const schedule = { id: doc.id, ...doc.data() };

      // Get project info if project_id exists
      if (schedule.project_id) {
        try {
          const projectDoc = await db.collection('projects').doc(schedule.project_id).get();
          if (projectDoc.exists) {
            const project = projectDoc.data();
            schedule.project = {
              _id: schedule.project_id,
              name: project.name,
              color: project.color || '#4A90E2'
            };
          }
        } catch (e) {}
      }

      // Convert to frontend format (Firestore uses camelCase)
      schedules.push({
        _id: schedule.id,
        title: schedule.title,
        description: schedule.description || '',
        startDate: schedule.startDate || schedule.start_date,
        endDate: schedule.endDate || schedule.end_date,
        type: schedule.type || 'construction',
        status: schedule.status || 'pending',
        priority: schedule.priority || 'normal',
        project: schedule.project || schedule.project_name || '',
        assignedTo: schedule.assignedTo || [],
        assigneeNames: schedule.assignee || schedule.assigneeNames || [],
        time: schedule.time,
        createdAt: schedule.createdAt || schedule.created_at,
        updatedAt: schedule.updatedAt || schedule.updated_at
      });
    }

    res.json(schedules);
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: '일정 조회 실패' });
  }
});

app.post('/schedules', authenticateToken, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const scheduleData = {
      title: req.body.title,
      description: req.body.description || '',
      start_date: req.body.start_date || req.body.startDate,
      end_date: req.body.end_date || req.body.endDate,
      type: req.body.type || 'construction',
      status: req.body.status || 'pending',
      priority: req.body.priority || 'normal',
      project_id: req.body.project_id || req.body.project || null,
      project_name: typeof req.body.project === 'string' ? req.body.project : null,
      assignee: req.body.assignedTo || req.body.assignee_ids || [],
      time: req.body.time || null,
      color: req.body.color || null,
      created_by: req.user.id,
      created_by_name: req.user.username,
      created_at: now,
      updated_at: now
    };

    const docRef = await db.collection('schedules').add(scheduleData);

    res.status(201).json({
      _id: docRef.id,
      title: scheduleData.title,
      description: scheduleData.description,
      startDate: scheduleData.start_date,
      endDate: scheduleData.end_date,
      type: scheduleData.type,
      status: scheduleData.status,
      priority: scheduleData.priority,
      project: scheduleData.project_name || '',
      assigneeNames: scheduleData.assignee
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: '일정 생성 실패' });
  }
});

app.put('/schedules/:id', authenticateToken, async (req, res) => {
  try {
    const updates = { updated_at: admin.firestore.FieldValue.serverTimestamp() };

    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.startDate !== undefined) updates.start_date = req.body.startDate;
    if (req.body.start_date !== undefined) updates.start_date = req.body.start_date;
    if (req.body.endDate !== undefined) updates.end_date = req.body.endDate;
    if (req.body.end_date !== undefined) updates.end_date = req.body.end_date;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.priority !== undefined) updates.priority = req.body.priority;
    if (req.body.type !== undefined) updates.type = req.body.type;
    if (req.body.assignedTo !== undefined) updates.assignee = req.body.assignedTo;
    if (req.body.time !== undefined) updates.time = req.body.time;

    await db.collection('schedules').doc(req.params.id).update(updates);
    const doc = await db.collection('schedules').doc(req.params.id).get();

    res.json({ _id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: '일정 수정 실패' });
  }
});

app.delete('/schedules/:id', authenticateToken, async (req, res) => {
  try {
    await db.collection('schedules').doc(req.params.id).delete();
    res.json({ message: '일정이 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '일정 삭제 실패' });
  }
});

// =====================
// Payment Requests Routes
// =====================
app.get('/payments', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('payment_requests').get();
    const payments = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      payments.push({
        id: doc.id,
        ...data,
        status: data.status || 'pending',  // status가 없으면 기본값 'pending'
        // 프론트엔드 호환성: requester_name 필드도 함께 반환
        requester_name: data.requestedBy || data.requester_name || data.created_by_name || '',
        // 프론트엔드 호환성: VAT/세금공제 필드 (스네이크 케이스로 변환, 정수값 1/0)
        includes_vat: data.includesVAT ? 1 : 0,
        apply_tax_deduction: data.applyTaxDeduction ? 1 : 0,
        // 프론트엔드 호환성: 송금완료 날짜 (completed_at -> paid_at)
        paid_at: data.completed_at || data.completionDate || data.paid_at || null
      });
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: '결제 조회 실패' });
  }
});

app.post('/payments', authenticateToken, async (req, res) => {
  try {
    const now = new Date().toISOString();

    // projectId로 프로젝트 이름 조회
    let projectName = '';
    if (req.body.projectId) {
      try {
        const projectDoc = await db.collection('projects').doc(String(req.body.projectId)).get();
        if (projectDoc.exists) {
          projectName = projectDoc.data().name || '';
        } else {
          // 프로젝트를 찾지 못하면 projectId 자체를 이름으로 사용 (문자열인 경우)
          projectName = String(req.body.projectId);
        }
      } catch (e) {
        console.error('프로젝트 조회 실패:', e);
        projectName = String(req.body.projectId);
      }
    }

    const paymentData = {
      ...req.body,
      project_name: projectName,  // 프로젝트 이름을 project_name으로 저장
      status: req.body.status || 'pending',
      created_by: req.user.id,
      created_by_name: req.user.username,  // JWT에서 username 저장
      requestedBy: req.body.requestedBy || req.user.username,  // 요청자 이름 (프론트엔드에서 전달)
      created_at: now,
      updated_at: now
    };
    const docRef = await db.collection('payment_requests').add(paymentData);
    res.status(201).json({ id: docRef.id, ...paymentData });
  } catch (error) {
    console.error('결제 생성 실패:', error);
    res.status(500).json({ error: '결제 생성 실패' });
  }
});

app.put('/payments/:id', authenticateToken, async (req, res) => {
  try {
    const docRef = db.collection('payment_requests').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: '결제요청을 찾을 수 없습니다.' });
    }

    // projectId가 있으면 프로젝트 이름 조회
    let updates = { ...req.body, updated_at: admin.firestore.FieldValue.serverTimestamp() };
    if (req.body.projectId) {
      try {
        const projectDoc = await db.collection('projects').doc(String(req.body.projectId)).get();
        if (projectDoc.exists) {
          updates.project_name = projectDoc.data().name || '';
        } else {
          updates.project_name = String(req.body.projectId);
        }
      } catch (e) {
        console.error('프로젝트 조회 실패:', e);
        updates.project_name = String(req.body.projectId);
      }
    }

    await docRef.update(updates);
    const updatedDoc = await docRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error('결제 수정 실패:', error);
    res.status(500).json({ error: '결제 수정 실패' });
  }
});

// 결제 상태 변경 (송금완료 등)
app.put('/payments/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const docRef = db.collection('payment_requests').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: '결제요청을 찾을 수 없습니다.' });
    }

    const updates = {
      status: status,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // completed 상태로 변경 시 completed_at 추가
    if (status === 'completed') {
      updates.completed_at = admin.firestore.FieldValue.serverTimestamp();
    }

    await docRef.update(updates);
    const updatedDoc = await docRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error('결제 상태 변경 실패:', error);
    res.status(500).json({ error: '결제 상태 변경 실패' });
  }
});

app.delete('/payments/:id', authenticateToken, async (req, res) => {
  try {
    await db.collection('payment_requests').doc(req.params.id).delete();
    res.json({ message: '결제가 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '결제 삭제 실패' });
  }
});

// 토스 송금 SMS 발송 (부가세/세금공제 미체크용)
app.post('/payments/send-toss-payment-sms', authenticateToken, async (req, res) => {
  try {
    const { recipientPhone, accountHolder, bankName, accountNumber, amount, projectName, itemName, process, paymentId } = req.body;

    console.log('[POST /api/payments/send-toss-payment-sms] SMS 발송 요청:', { paymentId, amount });

    // 필수 정보 확인
    if (!recipientPhone || !accountHolder || !bankName || !accountNumber || !amount) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }

    // 프로젝트명에서 앞 2글자 추출
    const projectPrefix = (projectName || '프로젝트').substring(0, 2);

    // 은행 코드 매핑
    const bankCodeMap = {
      'KB국민은행': '004', '국민은행': '004',
      '신한은행': '088', '우리은행': '020', '하나은행': '081',
      'NH농협은행': '011', '농협은행': '011',
      'IBK기업은행': '003', '기업은행': '003',
      'SC제일은행': '023', '한국씨티은행': '027', '씨티은행': '027',
      '새마을금고': '045', '신협': '048', '우체국': '071',
      'KDB산업은행': '002', '산업은행': '002', '수협은행': '007',
      '대구은행': '031', '부산은행': '032', '경남은행': '039',
      '광주은행': '034', '전북은행': '037', '제주은행': '035',
      '카카오뱅크': '090', '케이뱅크': '089', '토스뱅크': '092'
    };

    // 토스 딥링크용 은행명 매핑
    const tossBankNameMap = {
      'KB국민은행': '국민은행', '국민은행': '국민은행',
      'NH농협은행': '농협은행', '농협은행': '농협은행',
      'IBK기업은행': '기업은행', '기업은행': '기업은행',
      'KDB산업은행': '산업은행', '산업은행': '산업은행',
      '한국씨티은행': '씨티은행', '씨티은행': '씨티은행'
    };

    // 토스 딥링크 생성
    const cleanAccountNumber = accountNumber.replace(/-/g, '');
    const tossBankName = tossBankNameMap[bankName] || bankName;
    const bankCode = bankCodeMap[bankName] || '004';
    const tossDeeplink = `supertoss://send?amount=${amount}&bankCode=${bankCode}&bank=${encodeURIComponent(tossBankName)}&accountNo=${cleanAccountNumber}`;

    // 금액 포맷팅
    const formattedAmount = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // 송금완료 링크 생성
    const completeLink = paymentId ? `https://hvlab.app/payments?c=${paymentId}` : '';

    // SMS 메시지 생성 (공정/항목 포함)
    const processText = process || '';
    const itemText = itemName || '결제요청';
    let message = `${projectPrefix}/${processText}/${itemText}\n`;
    message += `${bankName} ${accountNumber} ${accountHolder}\n`;
    message += `${formattedAmount}원\n\n`;
    message += `토스송금:\n${tossDeeplink}`;

    // 송금완료 링크 추가
    if (completeLink) {
      message += `\n\n완료:\n${completeLink}`;
    }

    console.log('[토스 SMS] 발송할 메시지 길이:', message.length);

    // Solapi/CoolSMS API로 SMS 발송
    const crypto = require('crypto');
    const https = require('https');

    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString('hex');
    const signature = crypto
      .createHmac('sha256', SOLAPI_API_SECRET)
      .update(date + salt)
      .digest('hex');

    const smsData = JSON.stringify({
      message: {
        to: recipientPhone.replace(/-/g, ''),
        from: SOLAPI_FROM_NUMBER.replace(/-/g, ''),
        text: message,
        type: 'LMS',
        subject: ' '
      }
    });

    const smsResult = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.coolsms.co.kr',
        path: '/messages/v4/send',
        method: 'POST',
        headers: {
          'Authorization': `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(smsData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data: data });
          }
        });
      });
      req.on('error', reject);
      req.write(smsData);
      req.end();
    });

    if (smsResult.statusCode >= 200 && smsResult.statusCode < 300) {
      console.log('[토스 SMS] 발송 성공');
      res.json({
        success: true,
        message: '토스 송금 SMS가 발송되었습니다.'
      });
    } else {
      console.error('[토스 SMS] 발송 실패:', smsResult.data);
      res.status(400).json({
        success: false,
        error: smsResult.data?.message || 'SMS 발송에 실패했습니다.'
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

// =====================
// Work Requests Routes
// =====================
app.get('/workrequests', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('work_requests').get();
    const items = [];
    snapshot.forEach(doc => items.push({ _id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: '작업요청 조회 실패' });
  }
});

app.post('/workrequests', authenticateToken, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const data = {
      ...req.body,
      created_by: req.user.id,
      created_by_name: req.user.username,
      created_at: now,
      updated_at: now
    };
    const docRef = await db.collection('work_requests').add(data);
    res.status(201).json({ id: docRef.id, ...data });
  } catch (error) {
    res.status(500).json({ error: '작업요청 생성 실패' });
  }
});

// =====================
// AS Requests Routes
// =====================

// 날짜 형식 정규화 헬퍼 함수
const normalizeDate = (dateValue) => {
  if (!dateValue) return null;

  // 이미 ISO 형식이면 그대로 반환
  if (typeof dateValue === 'string' && dateValue.includes('T')) {
    return dateValue;
  }

  // Firestore Timestamp 객체인 경우
  if (dateValue && dateValue._seconds) {
    return new Date(dateValue._seconds * 1000).toISOString();
  }

  // "YYYY-MM-DD HH:mm:ss" 형식인 경우 ISO로 변환
  if (typeof dateValue === 'string') {
    // "2025-10-31 17:28:39" -> "2025-10-31T17:28:39.000Z"
    const parsed = new Date(dateValue.replace(' ', 'T'));
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return dateValue;
};

// AS 요청 데이터 정규화 (snake_case -> camelCase 및 날짜 형식 통일)
const normalizeASRequest = (doc) => {
  const data = doc.data();
  return {
    _id: doc.id,
    project: data.project,
    client: data.client,
    requestDate: normalizeDate(data.requestDate || data.request_date),
    siteAddress: data.siteAddress || data.site_address || '',
    entrancePassword: data.entrancePassword || data.entrance_password || '',
    description: data.description || '',
    scheduledVisitDate: normalizeDate(data.scheduledVisitDate || data.scheduled_visit_date),
    scheduledVisitTime: data.scheduledVisitTime || data.scheduled_visit_time || '',
    assignedTo: data.assignedTo || data.assigned_to || [],
    completionDate: normalizeDate(data.completionDate || data.completion_date),
    notes: data.notes || '',
    status: data.status || 'pending',
    images: data.images || [],
    createdAt: normalizeDate(data.createdAt || data.created_at),
    updatedAt: normalizeDate(data.updatedAt || data.updated_at)
  };
};

app.get('/as-requests', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('as_requests').get();
    const items = [];
    snapshot.forEach(doc => {
      items.push(normalizeASRequest(doc));
    });
    res.json(items);
  } catch (error) {
    console.error('Get AS requests error:', error);
    res.status(500).json({ error: 'AS요청 조회 실패' });
  }
});

app.get('/as-requests/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await db.collection('as_requests').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'AS 요청을 찾을 수 없습니다.' });
    }
    res.json(normalizeASRequest(doc));
  } catch (error) {
    console.error('Get AS request error:', error);
    res.status(500).json({ error: 'AS요청 조회 실패' });
  }
});

app.post('/as-requests', authenticateToken, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const data = {
      project: req.body.project,
      client: req.body.client,
      requestDate: req.body.requestDate || now,
      siteAddress: req.body.siteAddress,
      entrancePassword: req.body.entrancePassword || '',
      description: req.body.description || '',
      scheduledVisitDate: req.body.scheduledVisitDate || null,
      scheduledVisitTime: req.body.scheduledVisitTime || null,
      assignedTo: req.body.assignedTo || [],
      completionDate: req.body.completionDate || null,
      notes: req.body.notes || '',
      status: req.body.status || 'pending',
      images: req.body.images || [],
      created_by: req.user.id,
      created_by_name: req.user.username,
      createdAt: now,
      updatedAt: now
    };
    const docRef = await db.collection('as_requests').add(data);
    res.status(201).json({ _id: docRef.id, ...data });
  } catch (error) {
    console.error('Create AS request error:', error);
    res.status(500).json({ error: 'AS요청 생성 실패' });
  }
});

app.put('/as-requests/:id', authenticateToken, async (req, res) => {
  try {
    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 업데이트 가능한 필드들
    const allowedFields = [
      'project', 'client', 'requestDate', 'siteAddress', 'entrancePassword',
      'description', 'scheduledVisitDate', 'scheduledVisitTime', 'assignedTo',
      'completionDate', 'notes', 'status', 'images'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    await db.collection('as_requests').doc(req.params.id).update(updates);
    const doc = await db.collection('as_requests').doc(req.params.id).get();
    const data = doc.data();

    res.json({
      _id: doc.id,
      project: data.project,
      client: data.client,
      requestDate: data.requestDate,
      siteAddress: data.siteAddress,
      entrancePassword: data.entrancePassword,
      description: data.description,
      scheduledVisitDate: data.scheduledVisitDate,
      scheduledVisitTime: data.scheduledVisitTime,
      assignedTo: data.assignedTo || [],
      completionDate: data.completionDate,
      notes: data.notes,
      status: data.status || 'pending',
      images: data.images || [],
      createdAt: data.createdAt || data.created_at,
      updatedAt: data.updatedAt || data.updated_at
    });
  } catch (error) {
    console.error('Update AS request error:', error);
    res.status(500).json({ error: 'AS요청 수정 실패' });
  }
});

app.delete('/as-requests/:id', authenticateToken, async (req, res) => {
  try {
    const asRequestId = req.params.id;

    // AS 요청 확인
    const doc = await db.collection('as_requests').doc(asRequestId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'AS 요청을 찾을 수 없습니다.' });
    }

    // 연관된 일정 삭제 (asRequestId 필드가 있는 일정)
    const schedulesSnapshot = await db.collection('schedules')
      .where('asRequestId', '==', asRequestId)
      .get();

    const batch = db.batch();
    schedulesSnapshot.forEach(scheduleDoc => {
      batch.delete(scheduleDoc.ref);
    });

    // AS 요청 삭제
    batch.delete(db.collection('as_requests').doc(asRequestId));
    await batch.commit();

    console.log(`Deleted AS request ${asRequestId} and ${schedulesSnapshot.size} related schedules`);
    res.json({ message: 'AS 요청 및 관련 일정이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete AS request error:', error);
    res.status(500).json({ error: 'AS요청 삭제 실패' });
  }
});

// =====================
// Quote Inquiries Routes
// =====================
app.get('/quote-inquiries', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('quote_inquiries').get();
    const items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      items.push({
        id: doc.id,
        _id: doc.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address || '',
        projectType: data.projectType || data.project_type || '',
        budget: data.budget || '',
        message: data.message || '',
        createdAt: normalizeDate(data.createdAt || data.created_at),
        isRead: data.isRead || data.is_read || false
      });
    });
    // createdAt 기준 내림차순 정렬
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (error) {
    console.error('Get quote inquiries error:', error);
    res.status(500).json({ error: '견적문의 조회 실패' });
  }
});

// 견적문의 읽음 표시
app.put('/quote-inquiries/:id/read', authenticateToken, async (req, res) => {
  try {
    const docRef = db.collection('quote_inquiries').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: '견적문의를 찾을 수 없습니다.' });
    }
    await docRef.update({
      isRead: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark quote inquiry as read error:', error);
    res.status(500).json({ error: '견적문의 읽음 표시 실패' });
  }
});

// 견적문의 삭제
app.delete('/quote-inquiries/:id', authenticateToken, async (req, res) => {
  try {
    const docRef = db.collection('quote_inquiries').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: '견적문의를 찾을 수 없습니다.' });
    }
    await docRef.delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete quote inquiry error:', error);
    res.status(500).json({ error: '견적문의 삭제 실패' });
  }
});

// =====================
// Contractors Routes
// =====================
app.get('/contractors', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('contractors').get();
    const items = [];
    snapshot.forEach(doc => items.push({ _id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: '협력업체 조회 실패' });
  }
});

app.post('/contractors', authenticateToken, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const data = {
      ...req.body,
      created_by: req.user.id,
      created_by_name: req.user.username,
      created_at: now,
      updated_at: now
    };
    const docRef = await db.collection('contractors').add(data);
    res.status(201).json({ id: docRef.id, ...data });
  } catch (error) {
    res.status(500).json({ error: '협력업체 생성 실패' });
  }
});

// =====================
// Construction Payments Routes
// =====================
app.get('/construction-payments', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('construction_payments').get();
    const items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Ensure payments is always an array
      let payments = data.payments;
      if (typeof payments === 'string') {
        try {
          payments = JSON.parse(payments);
        } catch (e) {
          payments = [];
        }
      }
      if (!Array.isArray(payments)) {
        payments = [];
      }
      items.push({ _id: doc.id, ...data, payments });
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: '공사대금 조회 실패' });
  }
});

// =====================
// Additional Works Routes
// =====================
app.get('/additional-works', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('additional_works').get();
    const items = [];
    snapshot.forEach(doc => items.push({ _id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: '추가작업 조회 실패' });
  }
});

// =====================
// Specbook Routes
// =====================
app.get('/specbook/categories', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('specbook_categories').get();
    const categories = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // 프론트엔드는 string[] 형태를 기대하므로 이름만 반환
      if (data.name) {
        categories.push(data.name);
      }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: '스펙북 카테고리 조회 실패' });
  }
});

app.get('/specbook/library/meta', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('specbook_items').get();
    const items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Storage URL을 프론트엔드가 기대하는 필드명으로 매핑
      const item = { _id: doc.id, ...data };
      // main_image_url -> image_url (Storage URL 우선)
      if (data.main_image_url) {
        item.image_url = data.main_image_url;
      }
      // sub_image_urls -> sub_images (Storage URL 우선)
      if (data.sub_image_urls && data.sub_image_urls.length > 0) {
        item.sub_images = data.sub_image_urls;
      }
      items.push(item);
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: '스펙북 라이브러리 조회 실패' });
  }
});

// 프로젝트별 스펙북 아이템 조회 (연결 테이블 기반)
app.get('/specbook/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    console.log('[DEBUG] 프로젝트 스펙북 조회 시작 - projectId:', projectId);

    // specbook_project_items 전체를 가져와서 JavaScript에서 필터링
    // (REST API로 마이그레이션된 데이터와의 타입 호환성을 위해)
    const allLinksSnapshot = await db.collection('specbook_project_items').get();
    console.log('[DEBUG] specbook_project_items 문서 수:', allLinksSnapshot.size);

    // 해당 프로젝트의 링크만 필터링
    const projectLinks = [];
    allLinksSnapshot.forEach(doc => {
      const data = doc.data();
      console.log('[DEBUG] 문서:', doc.id, '데이터:', JSON.stringify(data));
      // project_id가 숫자 또는 문자열로 저장되어 있을 수 있음
      const docProjectId = typeof data.project_id === 'string'
        ? parseInt(data.project_id)
        : data.project_id;

      if (docProjectId === projectId) {
        projectLinks.push({ id: doc.id, ...data });
      }
    });

    console.log('[DEBUG] 필터링된 링크 수:', projectLinks.length);

    if (projectLinks.length === 0) {
      return res.json([]);
    }

    // 연결된 아이템들의 상세 정보 조회
    const items = [];
    for (const link of projectLinks) {
      const itemDoc = await db.collection('specbook_items').doc(String(link.item_id)).get();

      if (itemDoc.exists) {
        const data = itemDoc.data();
        const item = {
          _id: itemDoc.id,
          id: parseInt(itemDoc.id),
          link_id: link.id,
          order_index: link.order_index || 0,
          ...data
        };
        // Storage URL 매핑
        if (data.main_image_url) {
          item.image_url = data.main_image_url;
        }
        if (data.sub_image_urls && data.sub_image_urls.length > 0) {
          item.sub_images = data.sub_image_urls;
        }
        items.push(item);
      }
    }
    // order_index로 정렬
    items.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    res.json(items);
  } catch (error) {
    console.error('프로젝트 스펙북 조회 오류:', error);
    res.status(500).json({ error: '프로젝트 스펙북 조회 실패' });
  }
});

// 프로젝트에 스펙북 아이템 추가
app.post('/specbook/project/:projectId/item', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { item_id } = req.body;
    const itemIdNum = parseInt(item_id);

    if (!item_id) {
      return res.status(400).json({ error: 'item_id가 필요합니다.' });
    }

    // 전체 문서를 가져와서 JavaScript에서 필터링 (타입 호환성)
    const allSnapshot = await db.collection('specbook_project_items').get();

    // 이미 추가된 아이템인지 확인
    let alreadyExists = false;
    let maxOrder = 0;

    allSnapshot.forEach(doc => {
      const data = doc.data();
      const docProjectId = typeof data.project_id === 'string'
        ? parseInt(data.project_id)
        : data.project_id;
      const docItemId = typeof data.item_id === 'string'
        ? parseInt(data.item_id)
        : data.item_id;

      if (docProjectId === projectId) {
        // 같은 프로젝트 내 아이템 확인
        if (docItemId === itemIdNum) {
          alreadyExists = true;
        }
        // 최대 order_index 계산
        const orderIndex = data.order_index || 0;
        if (orderIndex >= maxOrder) {
          maxOrder = orderIndex + 1;
        }
      }
    });

    if (alreadyExists) {
      return res.status(400).json({ error: '이미 추가된 아이템입니다.' });
    }

    // 새 연결 생성
    const docRef = await db.collection('specbook_project_items').add({
      project_id: projectId,
      item_id: itemIdNum,
      order_index: maxOrder,
      created_at: new Date().toISOString()
    });

    res.json({ id: docRef.id, success: true });
  } catch (error) {
    console.error('프로젝트 아이템 추가 오류:', error);
    res.status(500).json({ error: '프로젝트 아이템 추가 실패' });
  }
});

// 프로젝트에서 스펙북 아이템 제거
app.delete('/specbook/project/:projectId/item/:itemId', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const itemId = parseInt(req.params.itemId);

    // 전체 문서를 가져와서 JavaScript에서 필터링 (타입 호환성)
    const allSnapshot = await db.collection('specbook_project_items').get();

    // 해당 연결 찾기
    const docsToDelete = [];
    allSnapshot.forEach(doc => {
      const data = doc.data();
      const docProjectId = typeof data.project_id === 'string'
        ? parseInt(data.project_id)
        : data.project_id;
      const docItemId = typeof data.item_id === 'string'
        ? parseInt(data.item_id)
        : data.item_id;

      if (docProjectId === projectId && docItemId === itemId) {
        docsToDelete.push(doc.ref);
      }
    });

    if (docsToDelete.length === 0) {
      return res.status(404).json({ error: '연결을 찾을 수 없습니다.' });
    }

    // 연결 삭제
    const batch = db.batch();
    docsToDelete.forEach(ref => batch.delete(ref));
    await batch.commit();

    res.json({ success: true });
  } catch (error) {
    console.error('프로젝트 아이템 제거 오류:', error);
    res.status(500).json({ error: '프로젝트 아이템 제거 실패' });
  }
});

// 프로젝트별 스펙북 아이템 조회 (레거시 - project_id 필드 기반)
app.get('/specbook/project/:projectId/meta', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const snapshot = await db.collection('specbook_items')
      .where('project_id', '==', projectId)
      .get();
    const items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const item = { _id: doc.id, ...data };
      // Storage URL 매핑
      if (data.main_image_url) {
        item.image_url = data.main_image_url;
      }
      if (data.sub_image_urls && data.sub_image_urls.length > 0) {
        item.sub_images = data.sub_image_urls;
      }
      items.push(item);
    });
    res.json(items);
  } catch (error) {
    console.error('프로젝트 스펙북 조회 오류:', error);
    res.status(500).json({ error: '프로젝트 스펙북 조회 실패' });
  }
});

// 스펙북 개별 아이템 조회
app.get('/specbook/item/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await db.collection('specbook_items').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }

    const rawData = doc.data();
    const data = { id: doc.id, ...rawData };

    // Storage URL을 프론트엔드가 기대하는 필드명으로 매핑
    // main_image_url -> image_url (Storage URL 우선)
    if (rawData.main_image_url) {
      data.image_url = rawData.main_image_url;
    }
    // sub_image_urls -> sub_images (Storage URL 우선)
    if (rawData.sub_image_urls && rawData.sub_image_urls.length > 0) {
      data.sub_images = rawData.sub_image_urls;
    }

    res.json(data);
  } catch (error) {
    console.error('스펙북 아이템 조회 오류:', error);
    res.status(500).json({ error: '스펙북 아이템 조회 실패' });
  }
});

// 스펙북 이미지 업로드 (Firebase Storage 사용)
app.post('/specbook/:id/upload-image', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { image, type } = req.body; // type: 'main' 또는 'sub', image: base64 string

    if (!image) {
      return res.status(400).json({ error: '이미지가 필요합니다.' });
    }

    // base64에서 실제 데이터 추출
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: '유효하지 않은 이미지 형식입니다.' });
    }

    const contentType = matches[1];
    const imageBuffer = Buffer.from(matches[2], 'base64');

    // 파일 확장자 결정
    const ext = contentType.includes('png') ? 'png' :
                contentType.includes('gif') ? 'gif' : 'jpg';

    // 파일 경로 생성
    const timestamp = Date.now();
    const filePath = type === 'main'
      ? `specbook/${id}/main.${ext}`
      : `specbook/${id}/sub_${timestamp}.${ext}`;

    // Firebase Storage에 업로드
    const file = bucket.file(filePath);
    await file.save(imageBuffer, {
      metadata: {
        contentType: contentType
      }
    });

    // 공개 URL 생성
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    // Firestore 업데이트
    const docRef = db.collection('specbook_items').doc(id);
    const doc = await docRef.get();

    if (type === 'main') {
      await docRef.update({ main_image_url: publicUrl });
    } else {
      const currentData = doc.data() || {};
      const subImageUrls = currentData.sub_image_urls || [];
      subImageUrls.push(publicUrl);
      await docRef.update({ sub_image_urls: subImageUrls });
    }

    res.json({ url: publicUrl });
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    res.status(500).json({ error: '이미지 업로드 실패' });
  }
});

// 스펙북 서브 이미지 저장 (하위 호환성 - base64 또는 URL 배열)
app.post('/specbook/:id/sub-images', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { sub_images } = req.body; // URL 또는 base64 배열

    if (!Array.isArray(sub_images)) {
      return res.status(400).json({ error: 'sub_images 배열이 필요합니다.' });
    }

    await db.collection('specbook_items').doc(id).update({ sub_images });
    res.json({ success: true });
  } catch (error) {
    console.error('서브 이미지 저장 오류:', error);
    res.status(500).json({ error: '서브 이미지 저장 실패' });
  }
});

// =====================
// Processes Routes
// =====================
app.get('/processes', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('processes').get();
    const items = [];
    snapshot.forEach(doc => items.push({ _id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: '공정 조회 실패' });
  }
});

// =====================
// Site Logs Routes
// =====================
app.get('/site-logs/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('site_logs')
      .where('project_id', '==', req.params.projectId)
      .get();
    const items = [];
    snapshot.forEach(doc => items.push({ _id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: '현장일지 조회 실패' });
  }
});

// =====================
// Execution Records Routes
// =====================
app.get('/execution-records', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('execution_records').get();
    const items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      items.push({
        _id: doc.id,
        id: data.id || parseInt(doc.id), // id 필드 보장
        ...data
      });
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: '실행내역 조회 실패' });
  }
});

// =====================
// Drawings Routes
// =====================
app.get('/drawings', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('drawings').get();
    const items = [];
    snapshot.forEach(doc => items.push({ _id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: '도면 조회 실패' });
  }
});

// =====================
// Finish Check Routes
// =====================
app.get('/finish-check/spaces', authenticateToken, async (req, res) => {
  try {
    const { project_id } = req.query;
    let query = db.collection('finish_check_spaces');
    if (project_id) {
      query = query.where('project_id', '==', project_id);
    }
    const snapshot = await query.get();
    const items = [];
    snapshot.forEach(doc => items.push({ _id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: '마감체크 공간 조회 실패' });
  }
});

// Cloud Function으로 Express 앱 내보내기
exports.api = functions
  .region('asia-northeast3')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onRequest(app);
