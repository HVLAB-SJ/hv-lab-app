const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeDatesArray } = require('../utils/dateUtils');

router.get('/', authenticateToken, (req, res) => {
  db.all(
    `SELECT ar.*, p.name as project_name
     FROM as_requests ar
     LEFT JOIN projects p ON ar.project_id = p.id
     ORDER BY ar.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('[GET /api/as-requests] Database error:', err);
        return res.status(500).json({ error: 'AS 요청 조회 실패' });
      }

      // Convert to frontend format
      const requests = (rows || []).map(row => ({
        _id: row.id?.toString() || '',
        project: row.project_name || '',
        client: row.client_name || '',
        requestDate: row.request_date || new Date().toISOString(),
        siteAddress: row.site_address || '',
        entrancePassword: row.entrance_password || '',
        description: row.description || '',
        scheduledVisitDate: row.scheduled_visit_date || null,
        scheduledVisitTime: row.scheduled_visit_time || null,
        assignedTo: row.assigned_to ? JSON.parse(row.assigned_to) : [],
        completionDate: row.completion_date || null,
        notes: row.notes || '',
        status: row.status || 'pending',
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString()
      }));

      res.json(requests);
    }
  );
});

router.post('/', authenticateToken, (req, res) => {
  console.log('[POST /api/as-requests] Received body:', req.body);

  // Support frontend format
  let project_id = req.body.project_id;
  const client_name = req.body.client || req.body.client_name || '';
  const request_date = req.body.requestDate || req.body.request_date || new Date().toISOString();
  const site_address = req.body.siteAddress || req.body.site_address || '';
  const entrance_password = req.body.entrancePassword || req.body.entrance_password || '';
  const description = req.body.description || '';
  const scheduled_visit_date = req.body.scheduledVisitDate || req.body.scheduled_visit_date || null;
  const scheduled_visit_time = req.body.scheduledVisitTime || req.body.scheduled_visit_time || null;
  const assigned_to = req.body.assignedTo ? JSON.stringify(req.body.assignedTo) : '[]';
  const notes = req.body.notes || '';
  const status = req.body.status || 'pending';

  // If project is a name (string), look up the project_id
  if (!project_id && req.body.project) {
    console.log('[POST /api/as-requests] Looking up project by name:', req.body.project);
    db.get('SELECT id, name FROM projects WHERE name = ?', [req.body.project], (err, project) => {
      if (err) {
        console.error('[POST /api/as-requests] Database error looking up project:', err);
        return res.status(500).json({ error: '프로젝트 조회 중 오류가 발생했습니다.' });
      }
      if (!project) {
        console.error('[POST /api/as-requests] Project not found:', req.body.project);
        return res.status(400).json({ error: '프로젝트를 찾을 수 없습니다.' });
      }
      console.log('[POST /api/as-requests] Found project:', project);
      project_id = project.id;
      insertASRequest();
    });
    return;
  }

  insertASRequest();

  function insertASRequest() {
    db.run(
      `INSERT INTO as_requests (
        project_id, client_name, request_date, site_address, entrance_password,
        description, scheduled_visit_date, scheduled_visit_time, assigned_to,
        notes, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project_id, client_name, request_date, site_address, entrance_password,
        description, scheduled_visit_date, scheduled_visit_time, assigned_to,
        notes, status, req.user.id
      ],
      function(err) {
        if (err) {
          console.error('[POST /api/as-requests] Database error:', err);
          return res.status(500).json({ error: 'AS 요청 생성 실패', details: err.message });
        }

        // Fetch the created request with project name
        db.get(
          `SELECT ar.*, p.name as project_name
           FROM as_requests ar
           LEFT JOIN projects p ON ar.project_id = p.id
           WHERE ar.id = ?`,
          [this.lastID],
          (err, row) => {
            if (err) {
              console.error('[POST /api/as-requests] Fetch error:', err);
              return res.status(500).json({ error: '생성된 AS 요청 조회 실패' });
            }

            const request = {
              _id: row.id?.toString() || '',
              project: row.project_name || '',
              client: row.client_name || '',
              requestDate: row.request_date || new Date().toISOString(),
              siteAddress: row.site_address || '',
              entrancePassword: row.entrance_password || '',
              description: row.description || '',
              scheduledVisitDate: row.scheduled_visit_date || null,
              scheduledVisitTime: row.scheduled_visit_time || null,
              assignedTo: row.assigned_to ? JSON.parse(row.assigned_to) : [],
              completionDate: row.completion_date || null,
              notes: row.notes || '',
              status: row.status || 'pending',
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString()
            };

            console.log('[POST /api/as-requests] Created:', request);
            res.status(201).json(request);
          }
        );
      }
    );
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  console.log('[PUT /api/as-requests/:id] Received body:', req.body);

  // Support frontend format
  let project_id = req.body.project_id;
  const updates = [];
  const values = [];

  // If project is a name (string), look up the project_id
  if (!project_id && req.body.project) {
    console.log('[PUT /api/as-requests/:id] Looking up project by name:', req.body.project);
    db.get('SELECT id, name FROM projects WHERE name = ?', [req.body.project], (err, project) => {
      if (err) {
        console.error('[PUT /api/as-requests/:id] Database error looking up project:', err);
        return res.status(500).json({ error: '프로젝트 조회 중 오류가 발생했습니다.' });
      }
      if (!project) {
        console.error('[PUT /api/as-requests/:id] Project not found:', req.body.project);
        return res.status(400).json({ error: '프로젝트를 찾을 수 없습니다.' });
      }
      console.log('[PUT /api/as-requests/:id] Found project:', project);
      project_id = project.id;
      updateASRequest();
    });
    return;
  }

  updateASRequest();

  function updateASRequest() {
    if (project_id !== undefined) {
      updates.push('project_id = ?');
      values.push(project_id);
    }
    if (req.body.client !== undefined || req.body.client_name !== undefined) {
      updates.push('client_name = ?');
      values.push(req.body.client || req.body.client_name);
    }
    if (req.body.requestDate !== undefined || req.body.request_date !== undefined) {
      updates.push('request_date = ?');
      values.push(req.body.requestDate || req.body.request_date);
    }
    if (req.body.siteAddress !== undefined || req.body.site_address !== undefined) {
      updates.push('site_address = ?');
      values.push(req.body.siteAddress || req.body.site_address);
    }
    if (req.body.entrancePassword !== undefined || req.body.entrance_password !== undefined) {
      updates.push('entrance_password = ?');
      values.push(req.body.entrancePassword || req.body.entrance_password);
    }
    if (req.body.description !== undefined) {
      updates.push('description = ?');
      values.push(req.body.description);
    }
    if (req.body.scheduledVisitDate !== undefined || req.body.scheduled_visit_date !== undefined) {
      updates.push('scheduled_visit_date = ?');
      values.push(req.body.scheduledVisitDate || req.body.scheduled_visit_date);
    }
    if (req.body.scheduledVisitTime !== undefined || req.body.scheduled_visit_time !== undefined) {
      updates.push('scheduled_visit_time = ?');
      values.push(req.body.scheduledVisitTime || req.body.scheduled_visit_time);
    }
    if (req.body.assignedTo !== undefined) {
      updates.push('assigned_to = ?');
      values.push(JSON.stringify(req.body.assignedTo));
    }
    if (req.body.completionDate !== undefined || req.body.completion_date !== undefined) {
      updates.push('completion_date = ?');
      values.push(req.body.completionDate || req.body.completion_date);
    }
    if (req.body.notes !== undefined) {
      updates.push('notes = ?');
      values.push(req.body.notes);
    }
    if (req.body.status !== undefined) {
      updates.push('status = ?');
      values.push(req.body.status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '수정할 필드가 없습니다.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE as_requests SET ${updates.join(', ')} WHERE id = ?`;

    console.log('[PUT /api/as-requests/:id] SQL Query:', query);
    console.log('[PUT /api/as-requests/:id] SQL Values:', values);

    db.run(query, values, function(err) {
      if (err) {
        console.error('[PUT /api/as-requests/:id] Database error:', err);
        return res.status(500).json({ error: 'AS 요청 수정 실패', details: err.message });
      }

      // Return updated request data with project name
      db.get(
        `SELECT ar.*, p.name as project_name
         FROM as_requests ar
         LEFT JOIN projects p ON ar.project_id = p.id
         WHERE ar.id = ?`,
        [id],
        (err, row) => {
          if (err) {
            console.error('[PUT /api/as-requests/:id] Fetch error:', err);
            return res.status(500).json({ error: '수정된 AS 요청 조회 실패' });
          }

          const request = {
            _id: row.id?.toString() || '',
            project: row.project_name || '',
            client: row.client_name || '',
            requestDate: row.request_date || new Date().toISOString(),
            siteAddress: row.site_address || '',
            entrancePassword: row.entrance_password || '',
            description: row.description || '',
            scheduledVisitDate: row.scheduled_visit_date || null,
            scheduledVisitTime: row.scheduled_visit_time || null,
            assignedTo: row.assigned_to ? JSON.parse(row.assigned_to) : [],
            completionDate: row.completion_date || null,
            notes: row.notes || '',
            status: row.status || 'pending',
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString()
          };

          console.log('[PUT /api/as-requests/:id] Updated:', request);
          res.json(request);
        }
      );
    });
  }
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
