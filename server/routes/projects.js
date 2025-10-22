const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');
const { sanitizeDatesArray, sanitizeDates } = require('../utils/dateUtils');

// 모든 프로젝트 조회 (status 필터링 지원)
router.get('/', authenticateToken, (req, res) => {
  const { status } = req.query;

  // Log the request for debugging
  console.log(`[GET /api/projects] Query params:`, req.query);
  console.log(`[GET /api/projects] Status filter:`, status);

  let query = `SELECT p.*, u.username as manager_name
               FROM projects p
               LEFT JOIN users u ON p.manager_id = u.id`;
  let params = [];

  if (status) {
    query += ` WHERE p.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY p.created_at DESC`;

  db.all(query, params, (err, projects) => {
    if (err) {
      console.error(`[GET /api/projects] Database error:`, err);
      return res.status(500).json({ error: '프로젝트 조회 실패' });
    }

    console.log(`[GET /api/projects] Found ${projects.length} projects`);

    // Convert SQLite dates to ISO 8601 (null dates are removed from response)
    const sanitized = sanitizeDatesArray(projects, ['created_at', 'updated_at', 'start_date', 'end_date']);
    res.json(sanitized);
  });
});

// 특정 프로젝트 조회
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT p.*, u.username as manager_name
     FROM projects p
     LEFT JOIN users u ON p.manager_id = u.id
     WHERE p.id = ?`,
    [id],
    (err, project) => {
      if (err) {
        return res.status(500).json({ error: '프로젝트 조회 실패' });
      }
      if (!project) {
        return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
      }

      // Convert SQLite dates to ISO 8601 (null dates are removed from response)
      const sanitized = sanitizeDates(project, ['created_at', 'updated_at', 'start_date', 'end_date']);
      res.json(sanitized);
    }
  );
});

// 프로젝트 생성
router.post('/', authenticateToken, isManager, (req, res) => {
  const {
    name,
    client,
    address,
    start_date,
    end_date,
    status,
    color,
    description
  } = req.body;

  db.run(
    `INSERT INTO projects (name, client, address, start_date, end_date, status, color, manager_id, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, client, address, start_date, end_date, status || 'planning', color || '#4A90E2', req.user.id, description],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '프로젝트 생성 실패' });
      }
      res.status(201).json({
        id: this.lastID,
        message: '프로젝트가 생성되었습니다.'
      });
    }
  );
});

// 프로젝트 수정
router.put('/:id', authenticateToken, isManager, (req, res) => {
  const { id } = req.params;
  const {
    name,
    client,
    address,
    start_date,
    end_date,
    status,
    color,
    manager_id,
    description
  } = req.body;

  db.run(
    `UPDATE projects
     SET name = ?, client = ?, address = ?, start_date = ?, end_date = ?,
         status = ?, color = ?, manager_id = ?, description = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, client, address, start_date || null, end_date || null, status, color, manager_id, description, id],
    function(err) {
      if (err) {
        console.error('프로젝트 수정 오류:', err);
        return res.status(500).json({ error: '프로젝트 수정 실패' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
      }
      res.json({ message: '프로젝트가 수정되었습니다.' });
    }
  );
});

// 프로젝트 삭제
router.delete('/:id', authenticateToken, isManager, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '프로젝트 삭제 실패' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    }
    res.json({ message: '프로젝트가 삭제되었습니다.' });
  });
});

// 프로젝트별 통계
router.get('/:id/stats', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT
       COUNT(DISTINCT s.id) as total_schedules,
       COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_schedules,
       COUNT(DISTINCT CASE WHEN s.status = 'in_progress' THEN s.id END) as in_progress_schedules,
       COUNT(DISTINCT CASE WHEN s.status = 'pending' THEN s.id END) as pending_schedules,
       AVG(s.progress) as average_progress
     FROM projects p
     LEFT JOIN schedules s ON p.id = s.project_id
     WHERE p.id = ?`,
    [id],
    (err, stats) => {
      if (err) {
        return res.status(500).json({ error: '통계 조회 실패' });
      }
      res.json(stats);
    }
  );
});

module.exports = router;
