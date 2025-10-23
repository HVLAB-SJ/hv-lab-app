const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeDatesArray } = require('../utils/dateUtils');

router.get('/', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM contractors ORDER BY name ASC',
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '협력업체 조회 실패' });
      }

      // Convert SQLite format to MongoDB-compatible format for frontend
      const contractors = (rows || []).map(row => ({
        _id: row.id.toString(),
        rank: row.rank || '',
        companyName: row.name,
        name: row.contact_person || '',
        position: row.position || '',
        process: row.specialty || '',
        contact: row.phone || '',
        bankName: row.bank_name || '',
        accountNumber: row.account_number || '',
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      res.json(contractors);
    }
  );
});

router.post('/', authenticateToken, (req, res) => {
  // Frontend sends: { companyName, name (contact person), position, process, contact, bankName, accountNumber, notes, rank }
  const companyName = req.body.companyName || req.body.name;
  const contactPerson = req.body.name;
  const position = req.body.position;
  const phone = req.body.contact || req.body.phone;
  const specialty = req.body.process || req.body.specialty;
  const bankName = req.body.bankName || req.body.bank_name;
  const accountNumber = req.body.accountNumber || req.body.account_number;
  const notes = req.body.notes;
  const rank = req.body.rank;
  const email = req.body.email;

  db.run(
    'INSERT INTO contractors (name, contact_person, position, phone, email, specialty, notes, bank_name, account_number, rank) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [companyName, contactPerson, position || '', phone, email || '', specialty, notes || '', bankName || '', accountNumber || '', rank || ''],
    function(err) {
      if (err) {
        console.error('Error creating contractor:', err);
        return res.status(500).json({ error: '협력업체 생성 실패' });
      }
      res.status(201).json({ _id: this.lastID.toString(), message: '협력업체가 생성되었습니다.' });
    }
  );
});

router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Frontend sends: { companyName, name (contact person), position, process, contact, bankName, accountNumber, notes, rank }
  const companyName = req.body.companyName || req.body.name;
  const contactPerson = req.body.name;
  const position = req.body.position;
  const phone = req.body.contact || req.body.phone;
  const specialty = req.body.process || req.body.specialty;
  const bankName = req.body.bankName || req.body.bank_name;
  const accountNumber = req.body.accountNumber || req.body.account_number;
  const notes = req.body.notes;
  const rank = req.body.rank;
  const email = req.body.email;

  db.run(
    'UPDATE contractors SET name = ?, contact_person = ?, position = ?, phone = ?, email = ?, specialty = ?, notes = ?, bank_name = ?, account_number = ?, rank = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [companyName, contactPerson, position || '', phone, email || '', specialty, notes || '', bankName || '', accountNumber || '', rank || '', id],
    function(err) {
      if (err) {
        console.error('Error updating contractor:', err);
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
