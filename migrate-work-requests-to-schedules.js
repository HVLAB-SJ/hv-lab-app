const { db } = require('./server/config/database');

console.log('🔄 Migrating existing work requests to schedules...\n');

// Get all work requests that are not completed
db.all('SELECT * FROM work_requests WHERE status != ?', ['completed'], (err, workRequests) => {
  if (err) {
    console.error('❌ Error loading work requests:', err);
    db.close();
    return;
  }

  console.log(`📋 Found ${workRequests.length} active work requests\n`);

  if (workRequests.length === 0) {
    console.log('✅ No work requests to migrate');
    db.close();
    return;
  }

  let processed = 0;
  let created = 0;
  let skipped = 0;

  workRequests.forEach((wr) => {
    // Check if schedule already exists for this work request
    db.get(
      'SELECT id FROM schedules WHERE title LIKE ? AND start_date = ?',
      [`%[업무요청]%${wr.request_type}%`, wr.due_date],
      (err, existingSchedule) => {
        if (err) {
          console.error(`❌ Error checking schedule for work request ${wr.id}:`, err);
          processed++;
          checkComplete();
          return;
        }

        if (existingSchedule) {
          console.log(`⏭️  Schedule already exists for work request ${wr.id} - ${wr.request_type}`);
          skipped++;
          processed++;
          checkComplete();
          return;
        }

        // Get project ID from project name
        db.get('SELECT id FROM projects WHERE name = ?', [wr.project], (err, project) => {
          if (err) {
            console.error(`❌ Error finding project for work request ${wr.id}:`, err);
            processed++;
            checkComplete();
            return;
          }

          if (!project) {
            console.warn(`⚠️  Project not found for work request ${wr.id}: ${wr.project}`);
            processed++;
            checkComplete();
            return;
          }

          // Get user ID from assignedTo name
          db.get('SELECT id FROM users WHERE name = ? OR username = ?', [wr.assigned_to, wr.assigned_to], (err, user) => {
            const description = `${wr.description || ''}\n\n담당자: ${wr.assigned_to}\n요청자: ${wr.requested_by}\n우선순위: ${wr.priority}\n${wr.notes || ''}`;

            // Create schedule
            db.run(
              `INSERT INTO schedules (project_id, title, description, start_date, end_date, type, status, priority, assigned_to, created_by, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                project.id,
                `[업무요청] ${wr.request_type}`,
                description,
                wr.due_date,
                wr.due_date,
                'other',
                'pending',
                wr.priority || 'medium',
                wr.assigned_to,
                1, // Default to first user
                wr.created_at || new Date().toISOString()
              ],
              function(err) {
                if (err) {
                  console.error(`❌ Error creating schedule for work request ${wr.id}:`, err);
                } else {
                  const scheduleId = this.lastID;
                  console.log(`✅ Created schedule ${scheduleId} for work request ${wr.id} - ${wr.request_type}`);

                  // Assign user to schedule if found
                  if (user) {
                    db.run(
                      'INSERT INTO schedule_assignees (schedule_id, user_id) VALUES (?, ?)',
                      [scheduleId, user.id],
                      (err) => {
                        if (err) {
                          console.error(`   ⚠️ Failed to assign user to schedule ${scheduleId}:`, err);
                        }
                      }
                    );
                  }

                  created++;
                }
                processed++;
                checkComplete();
              }
            );
          });
        });
      }
    );
  });

  function checkComplete() {
    if (processed === workRequests.length) {
      console.log(`\n✅ Migration complete!`);
      console.log(`   Created: ${created} schedules`);
      console.log(`   Skipped: ${skipped} schedules (already exist)`);
      console.log(`   Total: ${workRequests.length} work requests processed`);
      db.close();
    }
  }
});
