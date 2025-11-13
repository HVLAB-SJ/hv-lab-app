const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');
const { sanitizeDatesArray } = require('../utils/dateUtils');
const emailService = require('../../utils/emailService');

// 모든 견적문의 조회 (로그인한 사용자 누구나 가능)
router.get('/', authenticateToken, (req, res) => {
  db.all(
    `SELECT * FROM quote_inquiries ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching quote inquiries:', err);
        return res.status(500).json({ error: '견적문의 조회 실패' });
      }

      const inquiries = (rows || []).map(row => {
        let attachments = [];
        if (row.attachments) {
          try {
            attachments = JSON.parse(row.attachments);
          } catch (e) {
            console.error('Failed to parse attachments:', e);
          }
        }

        return {
          id: row.id.toString(),
          name: row.name,
          phone: row.phone,
          email: row.email,
          address: row.address,
          projectType: row.project_type,
          budget: row.budget,
          message: row.message,
          sashWork: row.sash_work,
          extensionWork: row.extension_work,
          preferredDate: row.preferred_date,
          areaSize: row.area_size,
          isRead: row.is_read === 1,
          isContacted: row.is_contacted === 1,
          createdAt: row.created_at,
          attachments: attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size
            // content는 다운로드 시에만 제공
          }))
        };
      });

      const sanitized = sanitizeDatesArray(inquiries, ['createdAt']);
      res.json(sanitized);
    }
  );
});

// 미읽음 견적문의 개수 조회
router.get('/unread-count', authenticateToken, (req, res) => {
  db.get(
    `SELECT COUNT(*) as count FROM quote_inquiries WHERE is_read = 0`,
    [],
    (err, row) => {
      if (err) {
        console.error('Error fetching unread count:', err);
        return res.status(500).json({ error: '미읽음 개수 조회 실패' });
      }
      res.json({ count: row.count });
    }
  );
});

// 미연락 견적문의 개수 조회
router.get('/uncontacted-count', authenticateToken, (req, res) => {
  db.get(
    `SELECT COUNT(*) as count FROM quote_inquiries WHERE is_contacted = 0`,
    [],
    (err, row) => {
      if (err) {
        console.error('Error fetching uncontacted count:', err);
        return res.status(500).json({ error: '미연락 개수 조회 실패' });
      }
      res.json({ count: row.count });
    }
  );
});

// 견적문의 읽음 처리
router.put('/:id/read', authenticateToken, (req, res) => {
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

// 견적문의 연락 완료 토글
router.put('/:id/contacted', authenticateToken, (req, res) => {
  const { id } = req.params;

  // 먼저 현재 상태 조회
  db.get(
    `SELECT is_contacted FROM quote_inquiries WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) {
        console.error('Error fetching current status:', err);
        return res.status(500).json({ error: '상태 조회 실패' });
      }

      if (!row) {
        return res.status(404).json({ error: '견적문의를 찾을 수 없습니다.' });
      }

      // 현재 상태의 반대로 토글
      const newStatus = row.is_contacted === 1 ? 0 : 1;

      db.run(
        `UPDATE quote_inquiries SET is_contacted = ? WHERE id = ?`,
        [newStatus, id],
        function(err) {
          if (err) {
            console.error('Error updating contacted status:', err);
            return res.status(500).json({ error: '연락 처리 실패' });
          }

          res.json({
            message: newStatus === 1 ? '연락 처리되었습니다.' : '연락 대기 상태로 변경되었습니다.',
            isContacted: newStatus === 1
          });
        }
      );
    }
  );
});

// 견적문의 생성 (외부 API - 인증 불필요)
router.post('/submit', (req, res) => {
  const { name, phone, email, address, projectType, budget, message } = req.body;

  if (!name || !phone || !email || !message) {
    return res.status(400).json({ error: '필수 정보를 입력해주세요.' });
  }

  // 중복 체크: 24시간 이내에 동일한 전화번호 또는 이메일로 제출된 견적문의가 있는지 확인
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  db.get(
    `SELECT id, created_at FROM quote_inquiries
     WHERE (phone = ? OR email = ?)
     AND created_at > ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone, email, oneDayAgo],
    (err, existingInquiry) => {
      if (err) {
        console.error('Error checking duplicate inquiry:', err);
        return res.status(500).json({ error: '견적문의 저장 실패' });
      }

      // 중복 견적문의가 있는 경우
      if (existingInquiry) {
        console.log('중복 견적문의 감지:', { phone, email, existingId: existingInquiry.id });
        return res.status(429).json({
          error: '이미 견적문의를 접수하셨습니다. 24시간 이내에는 중복 제출이 불가능합니다.',
          existingInquiryDate: existingInquiry.created_at
        });
      }

      // 중복이 아닌 경우 새로운 견적문의 저장
      db.run(
        `INSERT INTO quote_inquiries (name, phone, email, address, project_type, budget, message, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [name, phone, email, address || '', projectType || '', budget || '', message],
        function(err) {
          if (err) {
            console.error('Error creating quote inquiry:', err);
            return res.status(500).json({ error: '견적문의 저장 실패' });
          }

          console.log('새로운 견적문의 접수:', { id: this.lastID, phone, email });
          res.status(201).json({
            id: this.lastID,
            message: '견적문의가 접수되었습니다.'
          });
        }
      );
    }
  );
});

// 첨부파일 다운로드
router.get('/:id/attachment/:index', authenticateToken, (req, res) => {
  const { id, index } = req.params;

  db.get(
    `SELECT attachments FROM quote_inquiries WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) {
        console.error('Error fetching attachment:', err);
        return res.status(500).json({ error: '첨부파일 조회 실패' });
      }

      if (!row) {
        return res.status(404).json({ error: '견적문의를 찾을 수 없습니다.' });
      }

      if (!row.attachments) {
        return res.status(404).json({ error: '첨부파일이 없습니다.' });
      }

      try {
        const attachments = JSON.parse(row.attachments);
        const attachment = attachments[parseInt(index)];

        if (!attachment) {
          return res.status(404).json({ error: '첨부파일을 찾을 수 없습니다.' });
        }

        // Base64 디코딩하여 이미지 반환
        const buffer = Buffer.from(attachment.content, 'base64');
        res.set('Content-Type', attachment.contentType);
        res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
        res.send(buffer);
      } catch (error) {
        console.error('Error processing attachment:', error);
        res.status(500).json({ error: '첨부파일 처리 실패' });
      }
    }
  );
});

// 견적문의 삭제 (관리자만 가능)
router.delete('/:id', authenticateToken, isManager, (req, res) => {
  const { id } = req.params;

  db.run(
    `DELETE FROM quote_inquiries WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        console.error('Error deleting quote inquiry:', err);
        return res.status(500).json({ error: '견적문의 삭제 실패' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '견적문의를 찾을 수 없습니다.' });
      }

      console.log('견적문의 삭제:', { id });
      res.json({ message: '견적문의가 삭제되었습니다.' });
    }
  );
});

// 이메일 수동 체크 (관리자만 가능)
router.post('/check-email', authenticateToken, isManager, async (req, res) => {
  try {
    console.log('📧 수동 이메일 체크 시작...');
    const emails = await emailService.checkNewQuoteInquiries();
    res.json({
      success: true,
      message: `${emails.length}개의 견적문의를 가져왔습니다.`,
      count: emails.length
    });
  } catch (error) {
    console.error('❌ 이메일 체크 실패:', error);
    res.status(500).json({
      success: false,
      error: '이메일 체크 실패',
      details: error.message
    });
  }
});

module.exports = router;
