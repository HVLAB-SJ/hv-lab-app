const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeDatesArray } = require('../utils/dateUtils');

router.get('/', authenticateToken, (req, res) => {
  db.all(
    `SELECT cp.*, p.name as project_name, p.client
     FROM construction_payments cp
     LEFT JOIN projects p ON cp.project_id = p.id
     ORDER BY cp.payment_date DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('[GET /api/construction-payments] Database error:', err);
        return res.status(500).json({ error: '공사대금 조회 실패' });
      }

      // Convert each row to MongoDB-compatible format with fallback values
      const constructionPayments = (rows || []).map(row => ({
        _id: row.id.toString(),
        project: row.project_name || '',
        client: row.client || '',
        totalAmount: row.amount || 0,
        vatType: 'percentage',
        vatPercentage: 10,
        vatAmount: Math.round((row.amount || 0) * 0.1),
        payments: [{
          types: ['중도금'],
          amount: row.amount || 0,
          date: row.payment_date || new Date().toISOString().split('T')[0],
          method: row.payment_method || '계좌이체',
          notes: row.notes || ''
        }],
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString()
      }));

      res.json(constructionPayments);
    }
  );
});

router.post('/', authenticateToken, (req, res) => {
  console.log('[POST /api/construction-payments] Request body:', JSON.stringify(req.body, null, 2));

  // Support both old format (project_id, amount, etc.) and new format (project, client, totalAmount, etc.)
  const project_id = req.body.project_id;
  const amount = req.body.amount || req.body.totalAmount;
  const payment_date = req.body.payment_date || (req.body.payments && req.body.payments[0] ? req.body.payments[0].date : new Date().toISOString().split('T')[0]);
  const payment_method = req.body.payment_method || (req.body.payments && req.body.payments[0] ? req.body.payments[0].method : '계좌이체');
  const notes = req.body.notes || (req.body.payments && req.body.payments[0] ? req.body.payments[0].notes : '');

  // If project_id is not provided but project name is, look it up
  let finalProjectId = project_id;

  if (!finalProjectId && req.body.project) {
    // Look up project by name
    db.get('SELECT id FROM projects WHERE name = ?', [req.body.project], (err, project) => {
      if (err) {
        console.error('[POST /api/construction-payments] Project lookup error:', err);
        return res.status(500).json({ error: '프로젝트 조회 실패' });
      }

      if (!project) {
        console.error('[POST /api/construction-payments] Project not found:', req.body.project);
        return res.status(400).json({ error: '프로젝트를 찾을 수 없습니다' });
      }

      console.log('[POST /api/construction-payments] Found project:', project);
      insertPayment(project.id);
    });
  } else if (finalProjectId) {
    insertPayment(finalProjectId);
  } else {
    return res.status(400).json({ error: '프로젝트 정보가 필요합니다' });
  }

  function insertPayment(projectId) {
    console.log('[POST /api/construction-payments] Inserting payment with project_id:', projectId);
    db.run(
      'INSERT INTO construction_payments (project_id, amount, payment_date, payment_method, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [projectId, amount, payment_date, payment_method, notes, req.user.id],
      function(err) {
        if (err) {
          console.error('[POST /api/construction-payments] Insert error:', err);
          return res.status(500).json({ error: '공사대금 생성 실패' });
        }

        // Return full MongoDB-compatible data
        const insertId = this.lastID;
        console.log('[POST /api/construction-payments] Successfully inserted with ID:', insertId);

        db.get(
          `SELECT cp.*, p.name as project_name, p.client
           FROM construction_payments cp
           LEFT JOIN projects p ON cp.project_id = p.id
           WHERE cp.id = ?`,
          [insertId],
          (err, row) => {
            if (err) {
              console.error('[POST /api/construction-payments] Fetch error:', err);
              return res.status(500).json({ error: '공사대금 조회 실패' });
            }

            const constructionPayment = {
              _id: row.id.toString(),
              project: row.project_name || '',
              client: row.client || '',
              totalAmount: row.amount || 0,
              vatType: 'percentage',
              vatPercentage: 10,
              vatAmount: Math.round((row.amount || 0) * 0.1),
              payments: [{
                types: ['중도금'],
                amount: row.amount || 0,
                date: row.payment_date || new Date().toISOString().split('T')[0],
                method: row.payment_method || '계좌이체',
                notes: row.notes || ''
              }],
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString()
            };

            res.status(201).json(constructionPayment);
          }
        );
      }
    );
  }
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
