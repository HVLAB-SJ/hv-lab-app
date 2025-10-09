const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// 모든 사용자 조회 (관리자 전용)
router.get('/', authenticateToken, (req, res) => {
  db.all(
    'SELECT id, username, name, role, department, phone, email, created_at FROM users',
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: '사용자 조회 실패' });
      }
      res.json(users);
    }
  );
});

// 특정 사용자 조회
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(
    'SELECT id, username, name, role, department, phone, email, created_at FROM users WHERE id = ?',
    [id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: '사용자 조회 실패' });
      }
      if (!user) {
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      }
      res.json(user);
    }
  );
});

// 프로필 조회 (본인)
router.get('/profile/me', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, username, name, role, department, phone, email, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: '프로필 조회 실패' });
      }
      res.json(user);
    }
  );
});

// 프로필 업데이트 (본인)
router.put('/profile/me', authenticateToken, async (req, res) => {
  const { name, department, phone, email, password } = req.body;

  let query = 'UPDATE users SET name = ?, department = ?, phone = ?, email = ?';
  let params = [name, department, phone, email];

  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    query += ', password = ?';
    params.push(hashedPassword);
  }

  query += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  params.push(req.user.id);

  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: '프로필 업데이트 실패' });
    }
    res.json({ message: '프로필이 업데이트되었습니다.' });
  });
});

// 사용자 생성 (관리자 전용)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  const { username, password, name, role, department, phone, email } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (username, password, name, role, department, phone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, name, role || 'worker', department, phone, email],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });
          }
          return res.status(500).json({ error: '사용자 생성 실패' });
        }
        res.status(201).json({
          id: this.lastID,
          message: '사용자가 생성되었습니다.'
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 수정 (관리자 전용)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, role, department, phone, email, password } = req.body;

  let query = 'UPDATE users SET name = ?, role = ?, department = ?, phone = ?, email = ?';
  let params = [name, role, department, phone, email];

  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    query += ', password = ?';
    params.push(hashedPassword);
  }

  query += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  params.push(id);

  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: '사용자 수정 실패' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json({ message: '사용자가 수정되었습니다.' });
  });
});

// 사용자 삭제 (관리자 전용)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
  }

  db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '사용자 삭제 실패' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json({ message: '사용자가 삭제되었습니다.' });
  });
});

// 사용자별 할당된 일정 조회
router.get('/:id/schedules', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.all(
    `SELECT s.*, p.name as project_name, p.color as project_color
     FROM schedules s
     JOIN schedule_assignees sa ON s.id = sa.schedule_id
     JOIN projects p ON s.project_id = p.id
     WHERE sa.user_id = ?
     ORDER BY s.start_date ASC`,
    [id],
    (err, schedules) => {
      if (err) {
        return res.status(500).json({ error: '일정 조회 실패' });
      }
      res.json(schedules);
    }
  );
});

module.exports = router;