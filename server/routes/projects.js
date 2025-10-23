const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');
const { sanitizeDatesArray, sanitizeDates } = require('../utils/dateUtils');

// Helper function to parse JSON fields from database
const parseProjectJSON = (project) => {
  if (!project) return project;

  // Parse meeting_notes if exists
  if (project.meeting_notes) {
    try {
      project.meetingNotes = JSON.parse(project.meeting_notes);
      delete project.meeting_notes;
    } catch (e) {
      console.error('Error parsing meeting_notes:', e);
      project.meetingNotes = [];
    }
  } else {
    project.meetingNotes = [];
  }

  // Parse customer_requests if exists
  if (project.customer_requests) {
    try {
      project.customerRequests = JSON.parse(project.customer_requests);
      delete project.customer_requests;
    } catch (e) {
      console.error('Error parsing customer_requests:', e);
      project.customerRequests = [];
    }
  } else {
    project.customerRequests = [];
  }

  // Parse password fields
  if (project.entrance_password !== undefined) {
    project.entrancePassword = project.entrance_password || '';
    delete project.entrance_password;
  }
  if (project.site_password !== undefined) {
    project.sitePassword = project.site_password || '';
    delete project.site_password;
  }

  return project;
};

// 모든 프로젝트 조회 (status 필터링 지원)
router.get('/', authenticateToken, (req, res) => {
  const { status } = req.query;

  // Log the request for debugging
  console.log(`[GET /api/projects] Query params:`, req.query);
  console.log(`[GET /api/projects] Status filter:`, status);

  let query = `SELECT p.*,
               COALESCE(p.manager_name, u.username) as manager,
               u.username as manager_username
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

    // Parse JSON fields for each project
    const parsedProjects = projects.map(p => parseProjectJSON(p));

    // Convert SQLite dates to ISO 8601 (null dates are removed from response)
    const sanitized = sanitizeDatesArray(parsedProjects, ['created_at', 'updated_at', 'start_date', 'end_date']);
    res.json(sanitized);
  });
});

// 특정 프로젝트 조회
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT p.*,
     COALESCE(p.manager_name, u.username) as manager,
     u.username as manager_username
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

      // Parse JSON fields
      const parsed = parseProjectJSON(project);

      // Convert SQLite dates to ISO 8601 (null dates are removed from response)
      const sanitized = sanitizeDates(parsed, ['created_at', 'updated_at', 'start_date', 'end_date']);
      res.json(sanitized);
    }
  );
});

// 프로젝트 생성
router.post('/', authenticateToken, isManager, (req, res) => {
  console.log('[POST /api/projects] Received body:', req.body);

  // Support both frontend format and backend format
  const name = req.body.name;
  const client = typeof req.body.client === 'object' ? req.body.client.name : req.body.client;
  const address = req.body.address || (typeof req.body.location === 'object' ? req.body.location.address : req.body.location);
  const start_date = req.body.start_date || req.body.startDate;
  const end_date = req.body.end_date || req.body.endDate;
  const status = req.body.status || 'planning';
  const color = req.body.color || req.body.colorCode || '#4A90E2';
  const description = req.body.description || '';
  const manager = req.body.manager; // Manager name(s) from frontend

  console.log('[POST /api/projects] Parsed data:', {
    name, client, address, start_date, end_date, status, color, description, manager
  });

  db.run(
    `INSERT INTO projects (name, client, address, start_date, end_date, status, color, manager_id, description, manager_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, client, address, start_date, end_date, status, color, req.user.id, description, manager],
    function(err) {
      if (err) {
        console.error('[POST /api/projects] Database error:', err);
        return res.status(500).json({ error: '프로젝트 생성 실패' });
      }

      // Fetch the created project with full data
      db.get(
        `SELECT p.*,
         COALESCE(p.manager_name, u.username) as manager,
         u.username as manager_username
         FROM projects p
         LEFT JOIN users u ON p.manager_id = u.id
         WHERE p.id = ?`,
        [this.lastID],
        (err, project) => {
          if (err) {
            console.error('[POST /api/projects] Failed to fetch created project:', err);
            return res.status(500).json({ error: '프로젝트 조회 실패' });
          }

          console.log('[POST /api/projects] Created project:', project);
          const parsed = parseProjectJSON(project);
          const sanitized = sanitizeDates(parsed, ['created_at', 'updated_at', 'start_date', 'end_date']);
          res.status(201).json(sanitized);
        }
      );
    }
  );
});

// 프로젝트 수정
// Note: Removed isManager middleware to allow all authenticated users to update projects
// Workers can update manager, status, and other non-critical fields
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  console.log('[PUT /api/projects/:id] Received body:', JSON.stringify(req.body, null, 2));

  // Build dynamic UPDATE query for only provided fields
  const updates = [];
  const values = [];
  const processedFields = new Set(); // Track which fields we've already processed

  // Support both frontend format and backend format for field names
  if (req.body.client !== undefined) {
    const client = typeof req.body.client === 'object' ? req.body.client.name : req.body.client;
    updates.push('client = ?');
    values.push(client);
    processedFields.add('client');
  }
  if (req.body.location !== undefined) {
    const address = typeof req.body.location === 'object' ? req.body.location.address : req.body.location;
    updates.push('address = ?');
    values.push(address);
    processedFields.add('address');
  }
  if (req.body.startDate !== undefined) {
    // Convert ISO date string to YYYY-MM-DD format if needed
    let startDate = req.body.startDate;
    if (typeof startDate === 'string' && startDate.includes('T')) {
      startDate = startDate.split('T')[0];
    }
    updates.push('start_date = ?');
    values.push(startDate);
    processedFields.add('start_date');
    console.log('[PUT /api/projects/:id] Setting start_date to:', startDate);
  }
  if (req.body.endDate !== undefined) {
    // Convert ISO date string to YYYY-MM-DD format if needed
    let endDate = req.body.endDate;
    if (typeof endDate === 'string' && endDate.includes('T')) {
      endDate = endDate.split('T')[0];
    }
    updates.push('end_date = ?');
    values.push(endDate);
    processedFields.add('end_date');
    console.log('[PUT /api/projects/:id] Setting end_date to:', endDate);
  }
  if (req.body.manager !== undefined) {
    updates.push('manager_name = ?');
    values.push(req.body.manager);
    processedFields.add('manager_name');
  }

  // Handle JSON fields that need serialization
  if (req.body.meetingNotes !== undefined) {
    updates.push('meeting_notes = ?');
    values.push(JSON.stringify(req.body.meetingNotes));
    processedFields.add('meeting_notes');
  }
  if (req.body.customerRequests !== undefined) {
    updates.push('customer_requests = ?');
    values.push(JSON.stringify(req.body.customerRequests));
    processedFields.add('customer_requests');
  }
  if (req.body.entrancePassword !== undefined) {
    updates.push('entrance_password = ?');
    values.push(req.body.entrancePassword);
    processedFields.add('entrance_password');
  }
  if (req.body.sitePassword !== undefined) {
    updates.push('site_password = ?');
    values.push(req.body.sitePassword);
    processedFields.add('site_password');
  }

  // Only process remaining fields that weren't already handled
  // Note: We only check for fields that use snake_case in both frontend and backend
  const allowedFields = ['name', 'status', 'color', 'manager_id', 'description'];
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined && !processedFields.has(field)) {
      updates.push(`${field} = ?`);
      values.push(req.body[field] === '' ? null : req.body[field]);
    }
  });

  if (updates.length === 0) {
    console.log('[PUT /api/projects/:id] No updates found. Body keys:', Object.keys(req.body));
    return res.status(400).json({ error: '수정할 필드가 없습니다.' });
  }

  console.log('[PUT /api/projects/:id] Updates:', updates);
  console.log('[PUT /api/projects/:id] Values:', values);

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`;

  db.run(query, values, function(err) {
    if (err) {
      console.error('프로젝트 수정 오류:', err);
      return res.status(500).json({ error: '프로젝트 수정 실패' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    }

    // Return updated project data
    db.get(
      `SELECT p.*,
       COALESCE(p.manager_name, u.username) as manager,
       u.username as manager_username
       FROM projects p
       LEFT JOIN users u ON p.manager_id = u.id
       WHERE p.id = ?`,
      [id],
      (err, project) => {
        if (err) {
          return res.status(500).json({ error: '수정된 프로젝트 조회 실패' });
        }
        const parsed = parseProjectJSON(project);
        const sanitized = sanitizeDates(parsed, ['created_at', 'updated_at', 'start_date', 'end_date']);
        res.json(sanitized);
      }
    );
  });
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
