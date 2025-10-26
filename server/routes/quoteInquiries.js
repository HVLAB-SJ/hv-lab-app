const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');
const { sanitizeDatesArray } = require('../utils/dateUtils');

// 모든 견적문의 조회 (manager만 가능)
router.get('/', authenticateToken, isManager, (req, res) => {
  db.all(
    `SELECT * FROM quote_inquiries ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching quote inquiries:', err);
        return res.status(500).json({ error: '견적문의 조회 실패' });
      }

      const inquiries = (rows || []).map(row => ({
        id: row.id.toString(),
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        projectType: row.project_type,
        budget: row.budget,
        message: row.message,
        isRead: row.is_read === 1,
        createdAt: row.created_at
      }));

      const sanitized = sanitizeDatesArray(inquiries, ['createdAt']);
      res.json(sanitized);
    }
  );
});

// 견적문의 읽음 처리
router.put('/:id/read', authenticateToken, isManager, (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE quote_inquiries SET is_read = 1 WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        console.error('Error marking as read:', err);
        return res.status(500).json({ error: '읽음 처리 실패' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '견적문의를 찾을 수 없습니다.' });
      }

      res.json({ message: '읽음 처리되었습니다.' });
    }
  );
});

// 견적문의 생성 (외부 API - 인증 불필요)
router.post('/submit', (req, res) => {
  const { name, phone, email, address, projectType, budget, message } = req.body;

  if (!name || !phone || !email || !message) {
    return res.status(400).json({ error: '필수 정보를 입력해주세요.' });
  }

  db.run(
    `INSERT INTO quote_inquiries (name, phone, email, address, project_type, budget, message, is_read)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [name, phone, email, address || '', projectType || '', budget || '', message],
    function(err) {
      if (err) {
        console.error('Error creating quote inquiry:', err);
        return res.status(500).json({ error: '견적문의 저장 실패' });
      }

      res.status(201).json({
        id: this.lastID,
        message: '견적문의가 접수되었습니다.'
      });
    }
  );
});

module.exports = router;
