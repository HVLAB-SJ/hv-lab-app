const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeDatesArray, sanitizeDates } = require('../utils/dateUtils');

// 일정 목록 조회 (프로젝트별 또는 전체)
router.get('/', authenticateToken, (req, res) => {
  const { project_id, start_date, end_date, status } = req.query;
  const currentUserId = req.user.id; // 현재 로그인한 사용자 ID

  let query = `
    SELECT s.*,
           COALESCE(p.name, s.project_name) as project_name,
           p.color as project_color,
           u.username as creator_name
    FROM schedules s
    LEFT JOIN projects p ON s.project_id = p.id
    LEFT JOIN users u ON s.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  // 비공개 일정은 작성자에게만 보이도록 필터링
  // project_name이 NULL이거나, '비공개'가 아니거나, 작성자인 경우 모두 보여줌
  query += ' AND (s.project_name IS NULL OR s.project_name != ? OR s.created_by = ?)';
  params.push('비공개', currentUserId);

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

      // Handle project data - can be object or string
      let projectData;
      if (schedule.project_id && schedule.project_name) {
        // Full project object (project exists in projects table)
        projectData = {
          _id: schedule.project_id.toString(),
          name: schedule.project_name,
          color: schedule.project_color || '#4A90E2'
        };
      } else if (schedule.project_name) {
        // Just project name as string (direct input, no project_id)
        projectData = schedule.project_name;
      } else if (schedule.project_id) {
        // Has project_id but no name from join (shouldn't happen but handle it)
        projectData = {
          _id: schedule.project_id.toString(),
          name: 'Unknown Project',
          color: '#4A90E2'
        };
      } else {
        // No project - return empty string to prevent null errors
        projectData = '';
      }

      // Get assignee names from schedule_assignees table
      let allAssigneeNames = assignees.map(u => u.name || u.username);

      // Only use assigned_to column if no assignees were found in schedule_assignees table
      // This prevents auto-adding team names when specific users are selected
      if (allAssigneeNames.length === 0 && schedule.assigned_to) {
        const assignedToNames = schedule.assigned_to.split(',').map(name => name.trim()).filter(name => name);
        allAssigneeNames = assignedToNames;
      }

      return {
        _id: schedule.id.toString(),
        title: schedule.title,
        description: schedule.description || '',
        startDate: schedule.start_date,
        endDate: schedule.end_date,
        type: schedule.type || 'construction',
        status: schedule.status || 'pending',
        priority: schedule.priority || 'normal',
        project: projectData,
        assignedTo: assignees.map(u => ({ _id: u.id.toString(), name: u.name || u.username, username: u.username })),
        assigneeNames: allAssigneeNames,
        time: schedule.time,
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
  let project_id = req.body.project_id || req.body.project;
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

  console.log('[POST /api/schedules] Initial parsed data:', {
    project_id, title, description, start_date, end_date, type, status, priority, color, assigned_to, assignee_ids
  });

  // Store project name for reference
  const project_name_input = typeof project_id === 'string' && isNaN(Number(project_id)) ? project_id : null;

  // If project_id is a string (project name), look it up
  if (project_id && typeof project_id === 'string' && isNaN(Number(project_id))) {
    console.log('[POST /api/schedules] Project is string, looking up project by name:', project_id);
    db.get('SELECT id FROM projects WHERE name = ?', [project_id], (err, project) => {
      if (err) {
        console.error('[POST /api/schedules] Project lookup error:', err);
        return res.status(500).json({ error: '프로젝트 조회 실패' });
      }
      if (!project) {
        // 프로젝트가 없으면 직접입력으로 간주하고 project_id는 NULL로, 이름만 저장
        console.log('[POST /api/schedules] Project not found in DB, treating as direct input:', project_id);
        createSchedule(null, project_id);
      } else {
        console.log('[POST /api/schedules] Found project ID:', project.id);
        createSchedule(project.id, project_id);
      }
    });
  } else {
    createSchedule(project_id, project_name_input);
  }

  function createSchedule(finalProjectId, projectNameForStorage) {
    console.log('[POST /api/schedules] Creating schedule with project_id:', finalProjectId, 'project_name:', projectNameForStorage);

    db.run(
      `INSERT INTO schedules
       (project_id, project_name, title, description, start_date, end_date, type, status, priority, color, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalProjectId,
        projectNameForStorage,
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
      console.log('[POST /api/schedules] assignee_ids:', assignee_ids);
      if (assignee_ids && Array.isArray(assignee_ids) && assignee_ids.length > 0) {
        console.log('[POST /api/schedules] Processing assignees:', assignee_ids);
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
                console.log('[POST /api/schedules] Retrieved assignees from DB:', users);
                if (err) resolve([]);
                else resolve(users || []);
              }
            );
          });

          // Handle project data - can be object or string
          let projectData;
          if (schedule.project_id && schedule.project_name) {
            // Full project object
            projectData = {
              _id: schedule.project_id.toString(),
              name: schedule.project_name,
              color: schedule.project_color || '#4A90E2'
            };
          } else if (schedule.project_name) {
            // Just project name as string
            projectData = schedule.project_name;
          } else {
            // No project - return empty string to prevent null errors
            projectData = '';
          }

          // Get assignee names from schedule_assignees table
          let allAssigneeNames = assignees.map(u => u.name || u.username);

          // Only use assigned_to column if no assignees were found in schedule_assignees table
          // This prevents auto-adding team names when specific users are selected
          if (allAssigneeNames.length === 0 && schedule.assigned_to) {
            const assignedToNames = schedule.assigned_to.split(',').map(name => name.trim()).filter(name => name);
            allAssigneeNames = assignedToNames;
          }

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
            project: projectData,
            assignedTo: assignees.map(u => ({ _id: u.id.toString(), name: u.name || u.username, username: u.username })),
            assigneeNames: allAssigneeNames,
            time: schedule.time,
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
  }
});

// 일정 수정
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  console.log('[PUT /api/schedules/:id] Received body:', JSON.stringify(req.body, null, 2));

  // Support both frontend format (startDate, endDate, assignedTo) and backend format (start_date, end_date, etc)
  // Clean title to remove any time text that might have been accidentally included
  const rawTitle = req.body.title;
  const title = rawTitle ? rawTitle.replace(/ - (오전|오후) \d{1,2}시$/, '').trim() : rawTitle;
  const description = req.body.description;
  const start_date = req.body.start_date || req.body.startDate;
  const end_date = req.body.end_date || req.body.endDate;
  const type = req.body.type || 'other';
  const status = req.body.status;
  const priority = req.body.priority;
  const color = req.body.color;
  const progress = req.body.progress;
  const assigned_to = req.body.assigned_to || (req.body.assignedTo ? req.body.assignedTo.join(', ') : null);
  const assignee_ids = req.body.assignee_ids || req.body.assignedTo;
  const project_id = req.body.project_id || req.body.project;
  const time = req.body.time;

  db.run(
    `UPDATE schedules
     SET title = ?, description = ?, start_date = ?, end_date = ?,
         type = ?, status = ?, priority = ?, color = ?, progress = ?,
         assigned_to = ?, project_id = ?, time = ?, updated_at = CURRENT_TIMESTAMP
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
      project_id,
      time,
      id
    ],
    function(err) {
      if (err) {
        console.error('[PUT /api/schedules/:id] Database error:', err);
        return res.status(500).json({ error: '일정 수정 실패: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
      }

      // 담당자 재할당 (assignee_ids가 배열일 경우)
      if (assignee_ids && Array.isArray(assignee_ids)) {
        db.run('DELETE FROM schedule_assignees WHERE schedule_id = ?', [id], (err) => {
          if (!err && assignee_ids.length > 0) {
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
                const assigneeValues = validUserIds.map(userId => `(${id}, ${userId})`).join(',');
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
            }).catch(err => {
              console.error('담당자 ID 변환 실패:', err);
            });
          }
        });
      }

      // Fetch the updated schedule with full data and convert to MongoDB format
      db.get(
        `SELECT s.*, p.name as project_name, p.color as project_color, u.username as creator_name
         FROM schedules s
         LEFT JOIN projects p ON s.project_id = p.id
         LEFT JOIN users u ON s.created_by = u.id
         WHERE s.id = ?`,
        [id],
        async (err, schedule) => {
          if (err) {
            console.error('[PUT /api/schedules/:id] Failed to fetch updated schedule:', err);
            return res.status(500).json({ error: '일정 조회 실패' });
          }

          // Get assignees
          const assignees = await new Promise((resolve) => {
            db.all(
              `SELECT u.id, u.username, u.name FROM schedule_assignees sa
               JOIN users u ON sa.user_id = u.id
               WHERE sa.schedule_id = ?`,
              [id],
              (err, users) => {
                if (err) resolve([]);
                else resolve(users || []);
              }
            );
          });

          // Handle project data - can be object or string
          let projectData;
          if (schedule.project_id && schedule.project_name) {
            // Full project object
            projectData = {
              _id: schedule.project_id.toString(),
              name: schedule.project_name,
              color: schedule.project_color || '#4A90E2'
            };
          } else if (schedule.project_name) {
            // Just project name as string
            projectData = schedule.project_name;
          } else {
            // No project - return empty string to prevent null errors
            projectData = '';
          }

          // Get assignee names from schedule_assignees table
          let allAssigneeNames = assignees.map(u => u.name || u.username);

          // Only use assigned_to column if no assignees were found in schedule_assignees table
          // This prevents auto-adding team names when specific users are selected
          if (allAssigneeNames.length === 0 && schedule.assigned_to) {
            const assignedToNames = schedule.assigned_to.split(',').map(name => name.trim()).filter(name => name);
            allAssigneeNames = assignedToNames;
          }

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
            project: projectData,
            assignedTo: assignees.map(u => ({ _id: u.id.toString(), name: u.name || u.username, username: u.username })),
            assigneeNames: allAssigneeNames,
            time: schedule.time,
            createdBy: schedule.created_by ? {
              _id: schedule.created_by.toString(),
              username: schedule.creator_name || ''
            } : null,
            createdAt: schedule.created_at,
            updatedAt: schedule.updated_at
          };

          console.log('[PUT /api/schedules/:id] Updated schedule:', convertedSchedule);
          res.json(convertedSchedule);
        }
      );
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
