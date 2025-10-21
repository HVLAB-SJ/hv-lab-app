const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM as_requests ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'AS 요청 조회 실패' });
      }
      res.json(rows || []);
    }
  );
});

router.post('/', authenticateToken, (req, res) => {
  const { project_id, client_name, client_phone, description, scheduled_date } = req.body;
  
  db.run(
    'INSERT INTO as_requests (project_id, client_name, client_phone, description, scheduled_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [project_id, client_name, client_phone, description, scheduled_date, 'pending', req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'AS 요청 생성 실패' });
      }
      res.status(201).json({ id: this.lastID, message: 'AS 요청이 생성되었습니다.' });
    }
  );
});

router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { status, scheduled_date, description } = req.body;
  
  db.run(
    'UPDATE as_requests SET status = ?, scheduled_date = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, scheduled_date, description, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'AS 요청 수정 실패' });
      }
      res.json({ message: 'AS 요청이 수정되었습니다.' });
    }
  );
});

router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM as_requests WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'AS 요청 삭제 실패' });
    }
    res.json({ message: 'AS 요청이 삭제되었습니다.' });
  });
});

module.exports = router;
