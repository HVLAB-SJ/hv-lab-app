const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');
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

      // Get assignee names from schedule_assignees table only
      // Do NOT fall back to assigned_to column to prevent unwanted auto-assignment
      let allAssigneeNames = assignees.map(u => u.name || u.username);

      // Convert individual user names back to team names if applicable
      const compressToTeamNames = (names) => {
        const nameSet = new Set(names);
        const result = [];

        // Check for HV LAB (all 6 members)
        const hvLabMembers = ['상준', '신애', '재천', '민기', '재성', '재현'];
        if (hvLabMembers.every(member => nameSet.has(member))) {
          result.push('HV LAB');
          hvLabMembers.forEach(member => nameSet.delete(member));
        }

        // Check for 디자인팀 (신애, 재성, 재현)
        const designTeamMembers = ['신애', '재성', '재현'];
        if (designTeamMembers.every(member => nameSet.has(member))) {
          result.push('디자인팀');
          designTeamMembers.forEach(member => nameSet.delete(member));
        }

        // Check for 현장팀 (재천, 민기)
        const fieldTeamMembers = ['재천', '민기'];
        if (fieldTeamMembers.every(member => nameSet.has(member))) {
          result.push('현장팀');
          fieldTeamMembers.forEach(member => nameSet.delete(member));
        }

        // Add remaining individual names
        result.push(...Array.from(nameSet));

        return result;
      };

      allAssigneeNames = compressToTeamNames(allAssigneeNames);

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
  // Don't auto-populate assigned_to from assignedTo array - keep them separate
  // assigned_to is for legacy team names, assignee_ids is for specific user selections
  const assigned_to = req.body.assigned_to || null; // Only use if explicitly provided
  const assignee_ids = req.body.assignee_ids || req.body.assignedTo;
  const time = req.body.time || null;

  console.log('[POST /api/schedules] Initial parsed data:', {
    project_id, title, description, start_date, end_date, type, status, priority, color, assigned_to, assignee_ids, time
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

    // 프로젝트 정보 조회해서 title 변환 (프로젝트명 앞2글자_고객명)
    const processTitle = () => {
      console.log('[processTitle] Original title:', title);
      console.log('[processTitle] finalProjectId:', finalProjectId);

      if (finalProjectId) {
        // 프로젝트 ID가 있으면 DB에서 정보 조회
        db.get('SELECT name, client FROM projects WHERE id = ?', [finalProjectId], (err, project) => {
          if (err || !project) {
            console.log('[processTitle] Project not found or error:', err);
            // 조회 실패 시 원본 title 사용
            insertSchedule(title);
            return;
          }

          console.log('[processTitle] Project found:', project);

          // 프로젝트명 앞 2글자 추출
          const projectPrefix = project.name.substring(0, 2);
          const clientName = project.client || '';

          console.log('[processTitle] projectPrefix:', projectPrefix, 'clientName:', clientName);

          // title이 "[프로젝트명]"으로 시작하면 변환
          if (title && title.startsWith('[') && title.includes(']')) {
            // [프로젝트명] 부분을 추출하고 나머지 내용 유지
            const titleContent = title.substring(title.indexOf(']') + 1).trim();
            const newTitle = clientName ? `[${projectPrefix}_${clientName}] ${titleContent}` : `[${projectPrefix}] ${titleContent}`;
            console.log('[processTitle] Transformed title:', newTitle);
            insertSchedule(newTitle);
          } else {
            console.log('[processTitle] Title does not start with [, using original');
            insertSchedule(title);
          }
        });
      } else {
        console.log('[processTitle] No project ID, using original title');
        // 프로젝트 ID가 없으면 원본 title 사용
        insertSchedule(title);
      }
    };

    function insertSchedule(finalTitle) {
      db.run(
        `INSERT INTO schedules
         (project_id, project_name, title, description, start_date, end_date, type, status, priority, color, assigned_to, time, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          finalProjectId,
          projectNameForStorage,
          finalTitle,
          description,
          start_date,
          end_date,
          type,
          status,
          priority,
          color,
          assigned_to,
          time,
          req.user.id
        ],
    function(err) {
      if (err) {
        console.error('[POST /api/schedules] Database error:', err);
        return res.status(500).json({ error: '일정 생성 실패', details: err.message });
      }

      const scheduleId = this.lastID;

      // 담당자 할당 (assignee_ids가 배열일 경우) - await를 사용하기 위해 async 함수로 처리
      const processAssignees = async () => {
        console.log('[POST /api/schedules] assignee_ids:', assignee_ids);
        if (assignee_ids && Array.isArray(assignee_ids) && assignee_ids.length > 0) {
          console.log('[POST /api/schedules] Processing assignees:', assignee_ids);

          // 팀 이름을 개별 이름으로 확장
          const expandTeamNames = (assignees) => {
            const expanded = [];
            assignees.forEach(assignee => {
              if (assignee === 'HV LAB') {
                expanded.push('상준', '신애', '재천', '민기', '재성', '재현');
              } else if (assignee === '디자인팀') {
                expanded.push('신애', '재성', '재현');
              } else if (assignee === '현장팀') {
                expanded.push('재천', '민기');
              } else {
                expanded.push(assignee);
              }
            });
            return [...new Set(expanded)]; // 중복 제거
          };

          const expandedAssignees = expandTeamNames(assignee_ids);
          console.log('[POST /api/schedules] Expanded assignees:', expandedAssignees);

          // assignee_ids가 숫자 배열인지 확인하고, 문자열이면 user id로 변환
          const userPromises = expandedAssignees.map(assignee => {
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

          try {
            const userIds = await Promise.all(userPromises);
            const validUserIds = userIds.filter(id => id !== null);
            if (validUserIds.length > 0) {
              // 기존 담당자 먼저 삭제 (중복 방지)
              await new Promise((resolve, reject) => {
                db.run(
                  `DELETE FROM schedule_assignees WHERE schedule_id = ?`,
                  [scheduleId],
                  (err) => {
                    if (err) {
                      console.error('기존 담당자 삭제 실패:', err);
                      reject(err);
                    } else {
                      console.log('[POST /api/schedules] Existing assignees deleted');
                      resolve();
                    }
                  }
                );
              });

              // 새로운 담당자 추가
              const assigneeValues = validUserIds.map(userId => `(${scheduleId}, ${userId})`).join(',');
              await new Promise((resolve, reject) => {
                db.run(
                  `INSERT INTO schedule_assignees (schedule_id, user_id) VALUES ${assigneeValues}`,
                  [],
                  (err) => {
                    if (err) {
                      console.error('담당자 할당 실패:', err);
                      reject(err);
                    } else {
                      console.log('[POST /api/schedules] Assignees inserted successfully');
                      resolve();
                    }
                  }
                );
              });
            }
          } catch (err) {
            console.error('담당자 ID 변환 또는 할당 실패:', err);
          }
        }
      };

      // 담당자 할당 완료 후 응답 반환
      processAssignees().then(() => {
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

          // Get assignee names from schedule_assignees table only
          // Do NOT fall back to assigned_to column to prevent unwanted auto-assignment
          let allAssigneeNames = assignees.map(u => u.name || u.username);

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
      });
    }
    );
    }

    // title 처리 및 일정 생성 시작
    processTitle();
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
  // Don't auto-populate assigned_to from assignedTo array - keep them separate
  // assigned_to is for legacy team names, assignee_ids is for specific user selections
  const assigned_to = req.body.assigned_to || null; // Only use if explicitly provided
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
            // 팀 이름을 개별 이름으로 확장
            const expandTeamNames = (assignees) => {
              const expanded = [];
              assignees.forEach(assignee => {
                if (assignee === 'HV LAB') {
                  expanded.push('상준', '신애', '재천', '민기', '재성', '재현');
                } else if (assignee === '디자인팀') {
                  expanded.push('신애', '재성', '재현');
                } else if (assignee === '현장팀') {
                  expanded.push('재천', '민기');
                } else {
                  expanded.push(assignee);
                }
              });
              return [...new Set(expanded)]; // 중복 제거
            };

            const expandedAssignees = expandTeamNames(assignee_ids);
            console.log('[PUT /api/schedules/:id] Expanded assignees:', expandedAssignees);

            // assignee_ids가 숫자 배열인지 확인하고, 문자열이면 user id로 변환
            const userPromises = expandedAssignees.map(assignee => {
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

          // Get assignee names from schedule_assignees table only
          // Do NOT fall back to assigned_to column to prevent unwanted auto-assignment
          let allAssigneeNames = assignees.map(u => u.name || u.username);

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

// 일정 제목 마이그레이션 (관리자 전용)
router.post('/migrate-titles', authenticateToken, isManager, (req, res) => {
  console.log('📋 일정 제목 마이그레이션 시작...');

  // 1. 모든 일정 조회
  db.all(`
    SELECT s.id, s.project_id, s.title, p.name as project_name, p.client
    FROM schedules s
    LEFT JOIN projects p ON s.project_id = p.id
    WHERE s.title LIKE '[%]%'
  `, [], (err, schedules) => {
    if (err) {
      console.error('❌ 일정 조회 실패:', err);
      return res.status(500).json({ error: '일정 조회 실패', details: err.message });
    }

    console.log(`📊 총 ${schedules.length}개의 일정을 찾았습니다.`);

    if (schedules.length === 0) {
      return res.json({ message: '변환할 일정이 없습니다.', updated: 0, skipped: 0 });
    }

    let updated = 0;
    let skipped = 0;
    let processed = 0;

    schedules.forEach((schedule) => {
      const { id, project_id, title, project_name, client } = schedule;

      if (!project_id || !project_name) {
        console.log(`⏭️  ID ${id}: 프로젝트 정보 없음, 건너뜀`);
        skipped++;
        processed++;
        checkComplete();
        return;
      }

      // 프로젝트명 앞 2글자 추출
      const projectPrefix = project_name.substring(0, 2);
      const clientName = client || '';

      // title에서 [프로젝트명] 부분 추출하고 나머지 내용 유지
      const titleContent = title.substring(title.indexOf(']') + 1).trim();
      const newTitle = clientName
        ? `[${projectPrefix}_${clientName}] ${titleContent}`
        : `[${projectPrefix}] ${titleContent}`;

      // 이미 변환된 형태면 건너뛰기
      if (title === newTitle) {
        console.log(`⏭️  ID ${id}: 이미 변환된 제목, 건너뜀`);
        skipped++;
        processed++;
        checkComplete();
        return;
      }

      console.log(`🔄 ID ${id}: "${title}" → "${newTitle}"`);

      db.run(
        `UPDATE schedules SET title = ? WHERE id = ?`,
        [newTitle, id],
        function(updateErr) {
          if (updateErr) {
            console.error(`❌ ID ${id} 업데이트 실패:`, updateErr);
            skipped++;
          } else {
            updated++;
            console.log(`✅ ID ${id} 업데이트 완료`);
          }
          processed++;
          checkComplete();
        }
      );
    });

    function checkComplete() {
      if (processed === schedules.length) {
        const message = `일정 제목 마이그레이션 완료: ${updated}개 업데이트, ${skipped}개 건너뜀`;
        console.log(`\n📊 ${message}`);
        res.json({ message, updated, skipped, total: schedules.length });
      }
    }
  });
});

module.exports = router;
