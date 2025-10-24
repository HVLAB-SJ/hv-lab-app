const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeDatesArray } = require('../utils/dateUtils');

router.get('/', authenticateToken, (req, res) => {
  db.all(
    `SELECT aw.*, p.name as project_name
     FROM additional_works aw
     LEFT JOIN projects p ON aw.project_id = p.id
     ORDER BY aw.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('[GET /api/additional-works] Database error:', err);
        return res.status(500).json({ error: '추가내역 조회 실패' });
      }

      // Convert to frontend format
      const works = (rows || []).map(row => ({
        _id: row.id?.toString() || '',
        project: row.project_name || '',
        description: row.description || '',
        amount: row.amount || 0,
        date: row.work_date || new Date().toISOString(),
        notes: row.notes || '',
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString()
      }));

      res.json(works);
    }
  );
});

router.post('/', authenticateToken, (req, res) => {
  console.log('[POST /api/additional-works] Received body:', req.body);

  // Support both frontend (project name) and backend (project_id) formats
  let project_id = req.body.project_id || req.body.projectId;
  const description = req.body.description || '';
  const amount = req.body.amount || 0;
  const work_date = req.body.work_date || req.body.date || new Date().toISOString();
  const notes = req.body.notes || '';

  // If project is a name (string), look up the project_id
  if (!project_id && req.body.project) {
    console.log('[POST /api/additional-works] Looking up project by name:', req.body.project);
    // First, try to find project by name
    db.get('SELECT id, name FROM projects WHERE name = ?', [req.body.project], (err, project) => {
      if (err) {
        console.error('[POST /api/additional-works] Database error looking up project:', err);
        return res.status(500).json({ error: '프로젝트 조회 중 오류가 발생했습니다.' });
      }
      if (!project) {
        console.error('[POST /api/additional-works] Project not found:', req.body.project);
        // List all projects for debugging
        db.all('SELECT id, name FROM projects', [], (err2, projects) => {
          if (!err2) {
            console.log('[POST /api/additional-works] Available projects:', projects.map(p => p.name));
          }
        });
        return res.status(400).json({ error: '프로젝트를 찾을 수 없습니다.' });
      }
      console.log('[POST /api/additional-works] Found project:', project);
      project_id = project.id;
      insertAdditionalWork();
    });
    return;
  }

  insertAdditionalWork();

  function insertAdditionalWork() {
    db.run(
      'INSERT INTO additional_works (project_id, description, amount, work_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [project_id, description, amount, work_date, notes, req.user.id],
      function(err) {
        if (err) {
          console.error('[POST /api/additional-works] Database error:', err);
          return res.status(500).json({ error: '추가내역 생성 실패' });
        }

        // Fetch the created work with project name
        db.get(
          `SELECT aw.*, p.name as project_name
           FROM additional_works aw
           LEFT JOIN projects p ON aw.project_id = p.id
           WHERE aw.id = ?`,
          [this.lastID],
          (err, row) => {
            if (err) {
              console.error('[POST /api/additional-works] Fetch error:', err);
              return res.status(500).json({ error: '생성된 추가내역 조회 실패' });
            }

            const work = {
              _id: row.id?.toString() || '',
              project: row.project_name || '',
              description: row.description || '',
              amount: row.amount || 0,
              date: row.work_date || new Date().toISOString(),
              notes: row.notes || '',
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString()
            };

            console.log('[POST /api/additional-works] Created:', work);
            res.status(201).json(work);
          }
        );
      }
    );
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  console.log('[PUT /api/additional-works/:id] Received body:', req.body);

  // Support both frontend (project name) and backend (project_id) formats
  let project_id = req.body.project_id || req.body.projectId;
  const description = req.body.description;
  const amount = req.body.amount;
  const work_date = req.body.work_date || req.body.date;
  const notes = req.body.notes;

  // If project is a name (string), look up the project_id
  if (!project_id && req.body.project) {
    console.log('[PUT /api/additional-works/:id] Looking up project by name:', req.body.project);
    db.get('SELECT id, name FROM projects WHERE name = ?', [req.body.project], (err, project) => {
      if (err) {
        console.error('[PUT /api/additional-works/:id] Database error looking up project:', err);
        return res.status(500).json({ error: '프로젝트 조회 중 오류가 발생했습니다.' });
      }
      if (!project) {
        console.error('[PUT /api/additional-works/:id] Project not found:', req.body.project);
        return res.status(400).json({ error: '프로젝트를 찾을 수 없습니다.' });
      }
      console.log('[PUT /api/additional-works/:id] Found project:', project);
      project_id = project.id;
      updateAdditionalWork();
    });
    return;
  }

  updateAdditionalWork();

  function updateAdditionalWork() {
    // Build dynamic update query with only provided fields
    const updates = [];
    const values = [];

    if (project_id !== undefined) {
      updates.push('project_id = ?');
      values.push(project_id);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (amount !== undefined) {
      updates.push('amount = ?');
      values.push(amount);
    }
    if (work_date !== undefined) {
      updates.push('work_date = ?');
      values.push(work_date);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '수정할 필드가 없습니다.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE additional_works SET ${updates.join(', ')} WHERE id = ?`;

    console.log('[PUT /api/additional-works/:id] SQL Query:', query);
    console.log('[PUT /api/additional-works/:id] SQL Values:', values);

    db.run(query, values, function(err) {
        if (err) {
          console.error('[PUT /api/additional-works/:id] Database error:', err);
          return res.status(500).json({ error: '추가내역 수정 실패', details: err.message });
        }

        // Return updated work data with project name
        db.get(
          `SELECT aw.*, p.name as project_name
           FROM additional_works aw
           LEFT JOIN projects p ON aw.project_id = p.id
           WHERE aw.id = ?`,
          [id],
          (err, row) => {
            if (err) {
              console.error('[PUT /api/additional-works/:id] Fetch error:', err);
              return res.status(500).json({ error: '수정된 추가내역 조회 실패' });
            }

            const work = {
              _id: row.id?.toString() || '',
              project: row.project_name || '',
              description: row.description || '',
              amount: row.amount || 0,
              date: row.work_date || new Date().toISOString(),
              notes: row.notes || '',
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString()
            };

            console.log('[PUT /api/additional-works/:id] Updated:', work);
            res.json(work);
          }
        );
      }
    );
  }
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
