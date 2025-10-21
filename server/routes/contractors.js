const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM contractors ORDER BY name ASC',
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '협력업체 조회 실패' });
      }
      res.json(rows || []);
    }
  );
});

router.post('/', authenticateToken, (req, res) => {
  const { name, contact_person, phone, email, specialty, notes } = req.body;
  
  db.run(
    'INSERT INTO contractors (name, contact_person, phone, email, specialty, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [name, contact_person, phone, email, specialty, notes],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '협력업체 생성 실패' });
      }
      res.status(201).json({ id: this.lastID, message: '협력업체가 생성되었습니다.' });
    }
  );
});

router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, contact_person, phone, email, specialty, notes } = req.body;
  
  db.run(
    'UPDATE contractors SET name = ?, contact_person = ?, phone = ?, email = ?, specialty = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, contact_person, phone, email, specialty, notes, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '협력업체 수정 실패' });
      }
      res.json({ message: '협력업체가 수정되었습니다.' });
    }
  );
});

router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM contractors WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '협력업체 삭제 실패' });
    }
    res.json({ message: '협력업체가 삭제되었습니다.' });
  });
});

module.exports = router;
