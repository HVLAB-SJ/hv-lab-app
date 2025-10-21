const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM construction_payments ORDER BY payment_date DESC',
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '공사대금 조회 실패' });
      }
      res.json(rows || []);
    }
  );
});

router.post('/', authenticateToken, (req, res) => {
  const { project_id, amount, payment_date, payment_method, notes } = req.body;
  
  db.run(
    'INSERT INTO construction_payments (project_id, amount, payment_date, payment_method, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [project_id, amount, payment_date, payment_method, notes, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '공사대금 생성 실패' });
      }
      res.status(201).json({ id: this.lastID, message: '공사대금이 생성되었습니다.' });
    }
  );
});

router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { amount, payment_date, payment_method, notes } = req.body;
  
  db.run(
    'UPDATE construction_payments SET amount = ?, payment_date = ?, payment_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [amount, payment_date, payment_method, notes, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '공사대금 수정 실패' });
      }
      res.json({ message: '공사대금이 수정되었습니다.' });
    }
  );
});

router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM construction_payments WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '공사대금 삭제 실패' });
    }
    res.json({ message: '공사대금이 삭제되었습니다.' });
  });
});

module.exports = router;
