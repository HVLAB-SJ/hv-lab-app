const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, (req, res) => {
  const { status, priority, assignedTo } = req.query;
  let query = 'SELECT * FROM work_requests WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (priority) {
    query += ' AND priority = ?';
    params.push(priority);
  }
  if (assignedTo) {
    query += ' AND assigned_to = ?';
    params.push(assignedTo);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '업무 요청 조회 실패' });
    }
    res.json(rows || []);
  });
});

router.post('/', authenticateToken, (req, res) => {
  const { title, description, priority, assigned_to, due_date } = req.body;
  
  db.run(
    'INSERT INTO work_requests (title, description, priority, assigned_to, due_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, description, priority || 'normal', assigned_to, due_date, 'pending', req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '업무 요청 생성 실패' });
      }
      res.status(201).json({ id: this.lastID, message: '업무 요청이 생성되었습니다.' });
    }
  );
});

router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { title, description, priority, assigned_to, status, due_date } = req.body;
  
  db.run(
    'UPDATE work_requests SET title = ?, description = ?, priority = ?, assigned_to = ?, status = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, description, priority, assigned_to, status, due_date, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '업무 요청 수정 실패' });
      }
      res.json({ message: '업무 요청이 수정되었습니다.' });
    }
  );
});

router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM work_requests WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '업무 요청 삭제 실패' });
    }
    res.json({ message: '업무 요청이 삭제되었습니다.' });
  });
});

module.exports = router;
