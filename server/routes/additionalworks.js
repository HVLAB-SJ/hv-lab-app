const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM additional_works ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '추가내역 조회 실패' });
      }
      res.json(rows || []);
    }
  );
});

router.post('/', authenticateToken, (req, res) => {
  const { project_id, description, amount, work_date } = req.body;
  
  db.run(
    'INSERT INTO additional_works (project_id, description, amount, work_date, created_by) VALUES (?, ?, ?, ?, ?)',
    [project_id, description, amount, work_date, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '추가내역 생성 실패' });
      }
      res.status(201).json({ id: this.lastID, message: '추가내역이 생성되었습니다.' });
    }
  );
});

router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { description, amount, work_date } = req.body;
  
  db.run(
    'UPDATE additional_works SET description = ?, amount = ?, work_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [description, amount, work_date, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '추가내역 수정 실패' });
      }
      res.json({ message: '추가내역이 수정되었습니다.' });
    }
  );
});

router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM additional_works WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '추가내역 삭제 실패' });
    }
    res.json({ message: '추가내역이 삭제되었습니다.' });
  });
});

module.exports = router;
