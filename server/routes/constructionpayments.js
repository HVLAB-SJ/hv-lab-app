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
     ORDER BY cp.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('[GET /api/construction-payments] Database error:', err);
        return res.status(500).json({ error: '공사대금 조회 실패' });
      }

      // Convert each row to MongoDB-compatible format with fallback values
      const constructionPayments = (rows || []).map(row => {
        // Parse payments JSON if exists
        let paymentsArray = [];
        try {
          paymentsArray = row.payments ? JSON.parse(row.payments) : [];
        } catch (e) {
          console.error('[GET /api/construction-payments] Error parsing payments JSON:', e);
          paymentsArray = [];
        }

        return {
          _id: row.id.toString(),
          project: row.project_name || '',
          client: row.client || '',
          totalAmount: row.amount || 0,
          vatType: row.vat_type || 'percentage',
          vatPercentage: row.vat_percentage ?? 100,
          vatAmount: row.vat_amount ?? 0,
          payments: paymentsArray,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString()
        };
      });

      res.json(constructionPayments);
    }
  );
});

router.post('/', authenticateToken, (req, res) => {
  console.log('[POST /api/construction-payments] Request body:', JSON.stringify(req.body, null, 2));

  // Support both old format (project_id, amount, etc.) and new format (project, client, totalAmount, etc.)
  const project_id = req.body.project_id;
  const amount = req.body.amount || req.body.totalAmount;
  const vat_type = req.body.vatType || 'percentage';
  const vat_percentage = req.body.vatPercentage ?? 100;
  const vat_amount = req.body.vatAmount ?? 0;
  const payments = req.body.payments || [];
  const payments_json = JSON.stringify(payments);

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
    console.log('[POST /api/construction-payments] amount:', amount, 'vat_type:', vat_type, 'vat_percentage:', vat_percentage, 'vat_amount:', vat_amount);

    db.run(
      'INSERT INTO construction_payments (project_id, amount, vat_type, vat_percentage, vat_amount, payments, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [projectId, amount, vat_type, vat_percentage, vat_amount, payments_json, req.user.id],
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

            // Parse payments JSON
            let paymentsArray = [];
            try {
              paymentsArray = row.payments ? JSON.parse(row.payments) : [];
            } catch (e) {
              console.error('[POST /api/construction-payments] Error parsing payments JSON:', e);
              paymentsArray = [];
            }

            const constructionPayment = {
              _id: row.id.toString(),
              project: row.project_name || '',
              client: row.client || '',
              totalAmount: row.amount || 0,
              vatType: row.vat_type || 'percentage',
              vatPercentage: row.vat_percentage ?? 100,
              vatAmount: row.vat_amount ?? 0,
              payments: paymentsArray,
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString()
            };

            console.log('[POST /api/construction-payments] Returning:', JSON.stringify(constructionPayment, null, 2));
            res.status(201).json(constructionPayment);
          }
        );
      }
    );
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  console.log('[PUT /api/construction-payments/:id] Received body:', JSON.stringify(req.body, null, 2));

  // Support both old format (amount, payment_date) and new format (totalAmount, payments array)
  const amount = req.body.totalAmount || req.body.amount;
  const vat_type = req.body.vatType;
  const vat_percentage = req.body.vatPercentage;
  const vat_amount = req.body.vatAmount;
  const payments = req.body.payments;

  // Build dynamic UPDATE query for only provided fields
  const updates = [];
  const values = [];

  if (amount !== undefined) {
    updates.push('amount = ?');
    values.push(amount);
  }
  if (vat_type !== undefined) {
    updates.push('vat_type = ?');
    values.push(vat_type);
  }
  if (vat_percentage !== undefined) {
    updates.push('vat_percentage = ?');
    values.push(vat_percentage);
  }
  if (vat_amount !== undefined) {
    updates.push('vat_amount = ?');
    values.push(vat_amount);
  }
  if (payments !== undefined) {
    updates.push('payments = ?');
    values.push(JSON.stringify(payments));
  }

  if (updates.length === 0) {
    console.log('[PUT /api/construction-payments/:id] No valid fields to update');
    return res.status(400).json({ error: '수정할 필드가 없습니다.' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `UPDATE construction_payments SET ${updates.join(', ')} WHERE id = ?`;
  console.log('[PUT /api/construction-payments/:id] Query:', query);
  console.log('[PUT /api/construction-payments/:id] Values:', values);

  db.run(query, values, function(err) {
    if (err) {
      console.error('[PUT /api/construction-payments/:id] Database error:', err);
      return res.status(500).json({ error: '공사대금 수정 실패' });
    }

    console.log('[PUT /api/construction-payments/:id] Updated rows:', this.changes);

    // Fetch updated record to return full data
    db.get(
      `SELECT cp.*, p.name as project_name, p.client
       FROM construction_payments cp
       LEFT JOIN projects p ON cp.project_id = p.id
       WHERE cp.id = ?`,
      [id],
      (err, row) => {
        if (err) {
          console.error('[PUT /api/construction-payments/:id] Fetch error:', err);
          return res.status(500).json({ error: '수정된 공사대금 조회 실패' });
        }

        // Parse payments JSON
        let paymentsArray = [];
        try {
          paymentsArray = row.payments ? JSON.parse(row.payments) : [];
        } catch (e) {
          console.error('[PUT /api/construction-payments/:id] Error parsing payments JSON:', e);
          paymentsArray = [];
        }

        const constructionPayment = {
          _id: row.id.toString(),
          project: row.project_name || '',
          client: row.client || '',
          totalAmount: row.amount || 0,
          vatType: row.vat_type || 'percentage',
          vatPercentage: row.vat_percentage ?? 100,
          vatAmount: row.vat_amount ?? 0,
          payments: paymentsArray,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString()
        };

        console.log('[PUT /api/construction-payments/:id] Returning:', JSON.stringify(constructionPayment, null, 2));
        res.json(constructionPayment);
      }
    );
  });
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
