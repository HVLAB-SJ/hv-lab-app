const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeDatesArray } = require('../utils/dateUtils');

router.get('/', authenticateToken, (req, res) => {
  const { status, priority, assignedTo } = req.query;
  let query = 'SELECT wr.*, u.username, u.name FROM work_requests wr LEFT JOIN users u ON wr.created_by = u.id WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND wr.status = ?';
    params.push(status);
  }
  if (priority) {
    query += ' AND wr.priority = ?';
    params.push(priority);
  }
  if (assignedTo) {
    query += ' AND wr.assigned_to = ?';
    params.push(assignedTo);
  }

  query += ' ORDER BY wr.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('[GET /api/workrequests] Database error:', err);
      return res.status(500).json({ error: '업무 요청 조회 실패' });
    }

    // Convert each row to MongoDB-compatible format with fallback values
    const workRequests = (rows || []).map(row => ({
      _id: row.id.toString(),
      project: row.project || '',
      requestType: row.request_type || row.title || '기타',
      description: row.description || '',
      requestDate: row.request_date || row.created_at || new Date().toISOString(),
      dueDate: row.due_date || new Date().toISOString(),
      requestedBy: row.requested_by || row.username || row.name || '알 수 없음',
      assignedTo: row.assigned_to || '',
      status: row.status || 'pending',
      priority: row.priority || 'medium',
      notes: '',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    }));

    res.json(workRequests);
  });
});

router.post('/', authenticateToken, (req, res) => {
  // Accept both frontend (camelCase) and backend (snake_case) field names
  const project = req.body.project || '';
  const requestType = req.body.requestType || req.body.request_type || req.body.title || '';
  const description = req.body.description || '';
  const requestDate = req.body.requestDate || req.body.request_date || new Date().toISOString();
  const dueDate = req.body.dueDate || req.body.due_date || new Date().toISOString();
  const requestedBy = req.body.requestedBy || req.body.requested_by || '';
  const assignedTo = req.body.assignedTo || req.body.assigned_to || '';
  const priority = req.body.priority || 'medium';
  const status = req.body.status || 'pending';

  console.log('[POST /api/workrequests] Received data:', {
    project, requestType, description, requestDate, dueDate, requestedBy, assignedTo, priority, status
  });

  db.run(
    'INSERT INTO work_requests (project, request_type, title, description, request_date, due_date, requested_by, assigned_to, priority, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [project, requestType, requestType, description, requestDate, dueDate, requestedBy, assignedTo, priority, status, req.user.id],
    function(err) {
      if (err) {
        console.error('[POST /api/workrequests] Database error:', err);
        return res.status(500).json({ error: '업무 요청 생성 실패' });
      }

      // Fetch the created work request to return full data
      db.get(
        'SELECT wr.*, u.username, u.name FROM work_requests wr LEFT JOIN users u ON wr.created_by = u.id WHERE wr.id = ?',
        [this.lastID],
        (err, row) => {
          if (err) {
            console.error('[POST /api/workrequests] Failed to fetch created request:', err);
            return res.status(500).json({ error: '생성된 업무 요청 조회 실패' });
          }

          // Convert to MongoDB-compatible format for frontend
          const workRequest = {
            _id: row.id.toString(),
            project: row.project || '',
            requestType: row.request_type || row.title || '기타',
            description: row.description || '',
            requestDate: row.request_date || row.created_at || new Date().toISOString(),
            dueDate: row.due_date || new Date().toISOString(),
            requestedBy: row.requested_by || row.username || row.name || '알 수 없음',
            assignedTo: row.assigned_to || '',
            status: row.status || 'pending',
            priority: row.priority || 'medium',
            notes: '',
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString()
          };

          console.log('[POST /api/workrequests] Created:', workRequest);
          res.status(201).json(workRequest);
        }
      );
    }
  );
});

router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Accept both frontend (camelCase) and backend (snake_case) field names
  const project = req.body.project || '';
  const requestType = req.body.requestType || req.body.request_type || req.body.title || '';
  const description = req.body.description || '';
  const requestDate = req.body.requestDate || req.body.request_date;
  const dueDate = req.body.dueDate || req.body.due_date;
  const requestedBy = req.body.requestedBy || req.body.requested_by || '';
  const assignedTo = req.body.assignedTo || req.body.assigned_to || '';
  const priority = req.body.priority || 'medium';
  const status = req.body.status || 'pending';

  console.log('[PUT /api/workrequests/:id] Updating ID:', id, 'with data:', {
    project, requestType, description, requestDate, dueDate, requestedBy, assignedTo, priority, status
  });

  db.run(
    'UPDATE work_requests SET project = ?, request_type = ?, title = ?, description = ?, request_date = ?, due_date = ?, requested_by = ?, assigned_to = ?, priority = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [project, requestType, requestType, description, requestDate, dueDate, requestedBy, assignedTo, priority, status, id],
    function(err) {
      if (err) {
        console.error('[PUT /api/workrequests/:id] Database error:', err);
        return res.status(500).json({ error: '업무 요청 수정 실패' });
      }

      // Fetch the updated work request to return full data
      db.get(
        'SELECT wr.*, u.username, u.name FROM work_requests wr LEFT JOIN users u ON wr.created_by = u.id WHERE wr.id = ?',
        [id],
        (err, row) => {
          if (err) {
            console.error('[PUT /api/workrequests/:id] Failed to fetch updated request:', err);
            return res.status(500).json({ error: '수정된 업무 요청 조회 실패' });
          }

          // Convert to MongoDB-compatible format with fallback values
          const workRequest = {
            _id: row.id.toString(),
            project: row.project || '',
            requestType: row.request_type || row.title || '기타',
            description: row.description || '',
            requestDate: row.request_date || row.created_at || new Date().toISOString(),
            dueDate: row.due_date || new Date().toISOString(),
            requestedBy: row.requested_by || row.username || row.name || '알 수 없음',
            assignedTo: row.assigned_to || '',
            status: row.status || 'pending',
            priority: row.priority || 'medium',
            notes: '',
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString()
          };

          console.log('[PUT /api/workrequests/:id] Updated:', workRequest);
          res.json(workRequest);
        }
      );
    }
  );
});

router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM work_requests WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '업무 요청 삭제 실패' });
    }
    res.json({ message: '업무 요청이 삭제되었습니다.' });
  });
});

module.exports = router;
