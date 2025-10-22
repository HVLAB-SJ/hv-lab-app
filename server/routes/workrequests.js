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
      project: '',  // work_requests table doesn't have project field
      requestType: row.title || '기타',
      description: row.description || '',
      requestDate: row.created_at || new Date().toISOString(),
      dueDate: row.due_date || new Date().toISOString(),
      requestedBy: row.username || row.name || '알 수 없음',
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
  const { title, description, priority, assigned_to, due_date } = req.body;

  db.run(
    'INSERT INTO work_requests (title, description, priority, assigned_to, due_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, description, priority || 'normal', assigned_to, due_date, 'pending', req.user.id],
    function(err) {
      if (err) {
        console.error('[POST /api/workrequests] Database error:', err);
        return res.status(500).json({ error: '업무 요청 생성 실패' });
      }

      // Fetch the created work request to return full data
      db.get(
        'SELECT * FROM work_requests WHERE id = ?',
        [this.lastID],
        (err, row) => {
          if (err) {
            console.error('[POST /api/workrequests] Failed to fetch created request:', err);
            return res.status(500).json({ error: '생성된 업무 요청 조회 실패' });
          }

          // Convert to MongoDB-compatible format for frontend
          const workRequest = {
            _id: row.id.toString(),
            project: '',  // work_requests table doesn't have project field
            requestType: row.title || '기타',
            description: row.description || '',
            requestDate: row.created_at || new Date().toISOString(),
            dueDate: row.due_date || new Date().toISOString(),
            requestedBy: req.user.username || req.user.name || '알 수 없음',
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
  const { title, description, priority, assigned_to, status, due_date } = req.body;

  db.run(
    'UPDATE work_requests SET title = ?, description = ?, priority = ?, assigned_to = ?, status = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, description, priority, assigned_to, status, due_date, id],
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
            project: '',
            requestType: row.title || '기타',
            description: row.description || '',
            requestDate: row.created_at || new Date().toISOString(),
            dueDate: row.due_date || new Date().toISOString(),
            requestedBy: row.username || row.name || '알 수 없음',
            assignedTo: row.assigned_to || '',
            status: row.status || 'pending',
            priority: row.priority || 'medium',
            notes: '',
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString()
          };

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
