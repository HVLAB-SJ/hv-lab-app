const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeDatesArray, sanitizeDates } = require('../utils/dateUtils');

// 일정 목록 조회 (프로젝트별 또는 전체)
router.get('/', authenticateToken, (req, res) => {
  const { project_id, start_date, end_date, status } = req.query;
  let query = `
    SELECT s.*, p.name as project_name, p.color as project_color, u.username as creator_name
    FROM schedules s
    LEFT JOIN projects p ON s.project_id = p.id
    LEFT JOIN users u ON s.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (project_id) {
    query += ' AND s.project_id = ?';
    params.push(project_id);
  }
  if (start_date) {
    query += ' AND s.end_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND s.start_date <= ?';
    params.push(end_date);
  }
  if (status) {
    query += ' AND s.status = ?';
    params.push(status);
  }

  query += ' ORDER BY s.start_date ASC';

  db.all(query, params, async (err, schedules) => {
    if (err) {
      return res.status(500).json({ error: '일정 조회 실패' });
    }

    // Convert SQLite format to MongoDB-compatible format for frontend
    const convertedSchedules = await Promise.all(schedules.map(async (schedule) => {
      // Get assignees for this schedule
      const assignees = await new Promise((resolve) => {
        db.all(
          `SELECT u.id, u.username, u.name FROM schedule_assignees sa
           JOIN users u ON sa.user_id = u.id
           WHERE sa.schedule_id = ?`,
          [schedule.id],
          (err, users) => {
            if (err) resolve([]);
            else resolve(users || []);
          }
        );
      });

      return {
        _id: schedule.id.toString(),
        title: schedule.title,
        description: schedule.description || '',
        startDate: schedule.start_date,
        endDate: schedule.end_date,
        type: schedule.type || 'construction',
        status: schedule.status || 'pending',
        priority: schedule.priority || 'normal',
        project: schedule.project_id ? {
          _id: schedule.project_id.toString(),
          name: schedule.project_name || '',
          color: schedule.project_color || ''
        } : schedule.project_name,
        assignedTo: assignees.map(u => ({ _id: u.id.toString(), name: u.name || u.username, username: u.username })),
        assigneeNames: assignees.map(u => u.name || u.username),
        createdBy: schedule.created_by ? {
          _id: schedule.created_by.toString(),
          username: schedule.creator_name || ''
        } : null,
        createdAt: schedule.created_at,
        updatedAt: schedule.updated_at
      };
    }));

    res.json(convertedSchedules);
  });
});

// 특정 일정 조회
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT s.*, p.name as project_name, u.username as creator_name
     FROM schedules s
     LEFT JOIN projects p ON s.project_id = p.id
     LEFT JOIN users u ON s.created_by = u.id
     WHERE s.id = ?`,
    [id],
    (err, schedule) => {
      if (err) {
        return res.status(500).json({ error: '일정 조회 실패' });
      }
      if (!schedule) {
        return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
      }

      // 담당자 목록 조회
      db.all(
        `SELECT u.id, u.username, u.department
         FROM schedule_assignees sa
         JOIN users u ON sa.user_id = u.id
         WHERE sa.schedule_id = ?`,
        [id],
        (err, assignees) => {
          if (err) {
            return res.status(500).json({ error: '담당자 조회 실패' });
          }
          schedule.assignees = assignees;
          // Convert SQLite dates to ISO 8601
          const sanitized = sanitizeDates(schedule, ['start_date', 'end_date', 'created_at', 'updated_at']);
          res.json(sanitized);
        }
      );
    }
  );
});

// 일정 생성
router.post('/', authenticateToken, (req, res) => {
  console.log('[POST /api/schedules] Received body:', req.body);

  // Support both frontend format (project, startDate, endDate, assignedTo) and backend format
  const project_id = req.body.project_id || req.body.project;
  const title = req.body.title;
  const description = req.body.description;
  const start_date = req.body.start_date || req.body.startDate;
  const end_date = req.body.end_date || req.body.endDate;
  const type = req.body.type || 'construction';
  const status = req.body.status || 'pending';
  const priority = req.body.priority || 'normal';
  const color = req.body.color;
  const assigned_to = req.body.assigned_to || (req.body.assignedTo ? req.body.assignedTo.join(', ') : null);
  const assignee_ids = req.body.assignee_ids || req.body.assignedTo;

  console.log('[POST /api/schedules] Parsed data:', {
    project_id, title, description, start_date, end_date, type, status, priority, color, assigned_to, assignee_ids
  });

  db.run(
    `INSERT INTO schedules
     (project_id, title, description, start_date, end_date, type, status, priority, color, assigned_to, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project_id,
      title,
      description,
      start_date,
      end_date,
      type,
      status,
      priority,
      color,
      assigned_to,
      req.user.id
    ],
    function(err) {
      if (err) {
        console.error('[POST /api/schedules] Database error:', err);
        return res.status(500).json({ error: '일정 생성 실패', details: err.message });
      }

      const scheduleId = this.lastID;

      // 담당자 할당 (assignee_ids가 배열일 경우)
      if (assignee_ids && Array.isArray(assignee_ids) && assignee_ids.length > 0) {
        // assignee_ids가 숫자 배열인지 확인하고, 문자열이면 user id로 변환
        const userPromises = assignee_ids.map(assignee => {
          // 숫자면 그대로 사용
          if (typeof assignee === 'number') {
            return Promise.resolve(assignee);
          }
          // 문자열이면 username으로 user id 찾기
          return new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE username = ? OR name = ?', [assignee, assignee], (err, user) => {
              if (err) reject(err);
              else resolve(user ? user.id : null);
            });
          });
        });

        Promise.all(userPromises).then(userIds => {
          const validUserIds = userIds.filter(id => id !== null);
          if (validUserIds.length > 0) {
            const assigneeValues = validUserIds.map(userId => `(${scheduleId}, ${userId})`).join(',');
            db.run(
              `INSERT INTO schedule_assignees (schedule_id, user_id) VALUES ${assigneeValues}`,
              [],
              (err) => {
                if (err) {
                  console.error('담당자 할당 실패:', err);
                }
              }
            );
          }
        }).catch(err => {
          console.error('담당자 ID 변환 실패:', err);
        });
      }

      // Fetch the created schedule with full data and convert to MongoDB format
      db.get(
        `SELECT s.*, p.name as project_name, p.color as project_color, u.username as creator_name
         FROM schedules s
         LEFT JOIN projects p ON s.project_id = p.id
         LEFT JOIN users u ON s.created_by = u.id
         WHERE s.id = ?`,
        [scheduleId],
        async (err, schedule) => {
          if (err) {
            console.error('[POST /api/schedules] Failed to fetch created schedule:', err);
            return res.status(500).json({ error: '일정 조회 실패' });
          }

          // Get assignees
          const assignees = await new Promise((resolve) => {
            db.all(
              `SELECT u.id, u.username, u.name FROM schedule_assignees sa
               JOIN users u ON sa.user_id = u.id
               WHERE sa.schedule_id = ?`,
              [scheduleId],
              (err, users) => {
                if (err) resolve([]);
                else resolve(users || []);
              }
            );
          });

          // Convert to MongoDB format for frontend
          const convertedSchedule = {
            _id: schedule.id.toString(),
            title: schedule.title,
            description: schedule.description || '',
            startDate: schedule.start_date,
            endDate: schedule.end_date,
            type: schedule.type || 'construction',
            status: schedule.status || 'pending',
            priority: schedule.priority || 'normal',
            project: schedule.project_id ? {
              _id: schedule.project_id.toString(),
              name: schedule.project_name || '',
              color: schedule.project_color || ''
            } : schedule.project_name,
            assignedTo: assignees.map(u => ({ _id: u.id.toString(), name: u.name || u.username, username: u.username })),
            assigneeNames: assignees.map(u => u.name || u.username),
            createdBy: schedule.created_by ? {
              _id: schedule.created_by.toString(),
              username: schedule.creator_name || ''
            } : null,
            createdAt: schedule.created_at,
            updatedAt: schedule.updated_at
          };

          console.log('[POST /api/schedules] Created schedule:', convertedSchedule);
          res.status(201).json(convertedSchedule);
        }
      );
    }
  );
});

// 일정 수정
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    start_date,
    end_date,
    type,
    status,
    priority,
    color,
    progress,
    assigned_to,
    assignee_ids
  } = req.body;

  db.run(
    `UPDATE schedules
     SET title = ?, description = ?, start_date = ?, end_date = ?,
         type = ?, status = ?, priority = ?, color = ?, progress = ?,
         assigned_to = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      title,
      description,
      start_date,
      end_date,
      type,
      status,
      priority,
      color,
      progress,
      assigned_to,
      id
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '일정 수정 실패' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
      }

      // 담당자 재할당
      if (assignee_ids) {
        db.run('DELETE FROM schedule_assignees WHERE schedule_id = ?', [id], (err) => {
          if (!err && assignee_ids.length > 0) {
            const assigneeValues = assignee_ids.map(userId => `(${id}, ${userId})`).join(',');
            db.run(
              `INSERT INTO schedule_assignees (schedule_id, user_id) VALUES ${assigneeValues}`,
              [],
              (err) => {
                if (err) {
                  console.error('담당자 재할당 실패:', err);
                }
              }
            );
          }
        });
      }

      res.json({ message: '일정이 수정되었습니다.' });
    }
  );
});

// 일정 삭제
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM schedules WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '일정 삭제 실패' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
    }
    res.json({ message: '일정이 삭제되었습니다.' });
  });
});

// 일정 진행률 업데이트
router.patch('/:id/progress', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { progress } = req.body;

  let status = 'in_progress';
  if (progress === 0) status = 'pending';
  else if (progress === 100) status = 'completed';

  db.run(
    `UPDATE schedules
     SET progress = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [progress, status, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '진행률 업데이트 실패' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
      }
      res.json({ message: '진행률이 업데이트되었습니다.', status });
    }
  );
});

// 일정에 댓글 추가
router.post('/:id/comments', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { content, type } = req.body;

  db.run(
    `INSERT INTO comments (schedule_id, user_id, content, type)
     VALUES (?, ?, ?, ?)`,
    [id, req.user.id, content, type || 'comment'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '댓글 추가 실패' });
      }
      res.status(201).json({
        id: this.lastID,
        message: '댓글이 추가되었습니다.'
      });
    }
  );
});

// 일정의 댓글 조회
router.get('/:id/comments', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.all(
    `SELECT c.*, u.username as user_name
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.schedule_id = ?
     ORDER BY c.created_at DESC`,
    [id],
    (err, comments) => {
      if (err) {
        return res.status(500).json({ error: '댓글 조회 실패' });
      }
      res.json(comments);
    }
  );
});

module.exports = router;
