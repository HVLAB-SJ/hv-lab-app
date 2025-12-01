const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// 모든 실행내역 조회
router.get('/', authenticateToken, (req, res) => {
  const query = `
    SELECT er.*, p.name as project_name
    FROM execution_records er
    LEFT JOIN projects p ON er.project_id = p.id
    ORDER BY er.date DESC, er.created_at DESC
  `;

  db.all(query, [], (err, records) => {
    if (err) {
      console.error('[GET /execution-records] Error:', err);
      return res.status(500).json({ message: '실행내역 조회 실패', error: err.message });
    }
    res.json(records);
  });
});

// 단일 실행내역 조회
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT er.*, p.name as project_name
    FROM execution_records er
    LEFT JOIN projects p ON er.project_id = p.id
    WHERE er.id = ?
  `;

  db.get(query, [id], (err, record) => {
    if (err) {
      console.error('[GET /execution-records/:id] Error:', err);
      return res.status(500).json({ message: '실행내역 조회 실패', error: err.message });
    }
    if (!record) {
      return res.status(404).json({ message: '실행내역을 찾을 수 없습니다' });
    }
    res.json(record);
  });
});

// 실행내역 생성
router.post('/', authenticateToken, (req, res) => {
  const {
    project_name,
    author,
    date,
    process,
    item_name,
    material_cost,
    labor_cost,
    vat_amount,
    total_amount,
    notes,
    payment_id
  } = req.body;

  console.log('[POST /execution-records] Creating:', { project_name, item_name, total_amount });

  // 프로젝트 ID 조회
  db.get('SELECT id FROM projects WHERE name = ?', [project_name], (err, project) => {
    if (err) {
      console.error('[POST /execution-records] Project lookup error:', err);
    }

    const projectId = project?.id || null;
    const now = new Date().toISOString();

    const query = `
      INSERT INTO execution_records (
        project_id, project_name, author, date, process, item_name,
        material_cost, labor_cost, vat_amount, total_amount, notes, payment_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [
      projectId,
      project_name,
      author || null,
      date,
      process || null,
      item_name,
      material_cost || 0,
      labor_cost || 0,
      vat_amount || 0,
      total_amount || 0,
      notes || null,
      payment_id || null,
      now,
      now
    ], function(err) {
      if (err) {
        console.error('[POST /execution-records] Insert error:', err);
        return res.status(500).json({ message: '실행내역 생성 실패', error: err.message });
      }

      const newId = this.lastID;
      console.log('[POST /execution-records] Created with ID:', newId);

      // 생성된 레코드 반환
      db.get(
        `SELECT er.*, p.name as project_name
         FROM execution_records er
         LEFT JOIN projects p ON er.project_id = p.id
         WHERE er.id = ?`,
        [newId],
        (err, record) => {
          if (err) {
            return res.status(500).json({ message: '생성된 레코드 조회 실패', error: err.message });
          }
          res.status(201).json(record);
        }
      );
    });
  });
});

// 실행내역 수정
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const {
    project_name,
    author,
    date,
    process,
    item_name,
    material_cost,
    labor_cost,
    vat_amount,
    total_amount,
    notes,
    payment_id
  } = req.body;

  console.log('[PUT /execution-records/:id] Updating:', id);

  // 프로젝트 ID 조회
  db.get('SELECT id FROM projects WHERE name = ?', [project_name], (err, project) => {
    const projectId = project?.id || null;
    const now = new Date().toISOString();

    const query = `
      UPDATE execution_records SET
        project_id = ?,
        project_name = ?,
        author = ?,
        date = ?,
        process = ?,
        item_name = ?,
        material_cost = ?,
        labor_cost = ?,
        vat_amount = ?,
        total_amount = ?,
        notes = ?,
        payment_id = ?,
        updated_at = ?
      WHERE id = ?
    `;

    db.run(query, [
      projectId,
      project_name,
      author || null,
      date,
      process || null,
      item_name,
      material_cost || 0,
      labor_cost || 0,
      vat_amount || 0,
      total_amount || 0,
      notes || null,
      payment_id || null,
      now,
      id
    ], function(err) {
      if (err) {
        console.error('[PUT /execution-records/:id] Error:', err);
        return res.status(500).json({ message: '실행내역 수정 실패', error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: '실행내역을 찾을 수 없습니다' });
      }

      // 수정된 레코드 반환
      db.get(
        `SELECT er.*, p.name as project_name
         FROM execution_records er
         LEFT JOIN projects p ON er.project_id = p.id
         WHERE er.id = ?`,
        [id],
        (err, record) => {
          if (err) {
            return res.status(500).json({ message: '수정된 레코드 조회 실패', error: err.message });
          }
          res.json(record);
        }
      );
    });
  });
});

// 실행내역 삭제
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  console.log('[DELETE /execution-records/:id] Deleting:', id);

  db.run('DELETE FROM execution_records WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('[DELETE /execution-records/:id] Error:', err);
      return res.status(500).json({ message: '실행내역 삭제 실패', error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: '실행내역을 찾을 수 없습니다' });
    }

    res.json({ message: '삭제되었습니다', id });
  });
});

module.exports = router;
