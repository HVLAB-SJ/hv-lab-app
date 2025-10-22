const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Use environment variable for DB path, fallback to local path
// For Railway, set DATABASE_PATH=/app/data/database.db and mount volume at /app/data
const dbDir = process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : path.join(__dirname, '../..');
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database.db');

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`✅ Created database directory: ${dbDir}`);
}

// 데이터베이스 연결
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('데이터베이스 연결 실패:', err.message);
  } else {
    console.log('SQLite 데이터베이스 연결 성공');
  }
});

// 테이블 생성
const initDatabase = () => {
  // 사용자 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'worker',
      department TEXT,
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 프로젝트(현장) 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      client TEXT,
      address TEXT,
      start_date DATE,
      end_date DATE,
      status TEXT DEFAULT 'planning',
      color TEXT DEFAULT '#4A90E2',
      manager_id INTEGER,
      manager_name TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (manager_id) REFERENCES users(id)
    )
  `);

  // Add manager_name column if it doesn't exist (migration)
  db.run(`
    ALTER TABLE projects ADD COLUMN manager_name TEXT
  `, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding manager_name column:', err);
    }
  });

  // Add meeting_notes column if it doesn't exist (migration)
  db.run(`
    ALTER TABLE projects ADD COLUMN meeting_notes TEXT
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ meeting_notes column already exists');
      } else {
        console.error('❌ Error adding meeting_notes column:', err);
      }
    } else {
      console.log('✓ meeting_notes column added successfully');
    }
  });

  // Add customer_requests column if it doesn't exist (migration)
  db.run(`
    ALTER TABLE projects ADD COLUMN customer_requests TEXT
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ customer_requests column already exists');
      } else {
        console.error('❌ Error adding customer_requests column:', err);
      }
    } else {
      console.log('✓ customer_requests column added successfully');
    }
  });

  // Add entrance_password column if it doesn't exist (migration)
  db.run(`
    ALTER TABLE projects ADD COLUMN entrance_password TEXT
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ entrance_password column already exists');
      } else {
        console.error('❌ Error adding entrance_password column:', err);
      }
    } else {
      console.log('✓ entrance_password column added successfully');
    }
  });

  // Add site_password column if it doesn't exist (migration)
  db.run(`
    ALTER TABLE projects ADD COLUMN site_password TEXT
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ site_password column already exists');
      } else {
        console.error('❌ Error adding site_password column:', err);
      }
    } else {
      console.log('✓ site_password column added successfully');
    }
  });

  // 일정 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      type TEXT DEFAULT 'construction',
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      color TEXT,
      progress INTEGER DEFAULT 0,
      assigned_to TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // 일정 담당자 테이블 (다대다 관계)
  db.run(`
    CREATE TABLE IF NOT EXISTS schedule_assignees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(schedule_id, user_id)
    )
  `);

  // 댓글/메모 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'comment',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 알림 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      schedule_id INTEGER,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
    )
  `);

  // 파일 첨부 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER,
      project_id INTEGER,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      filetype TEXT,
      filesize INTEGER,
      uploaded_by INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  // 결제 요청 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS payment_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      user_id INTEGER NOT NULL,
      request_type TEXT DEFAULT 'material',
      vendor_name TEXT,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      account_holder TEXT,
      bank_name TEXT,
      account_number TEXT,
      status TEXT DEFAULT 'pending',
      approved_by INTEGER,
      approved_at DATETIME,
      paid_at DATETIME,
      receipt_url TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    )
  `);

  // 결제 요청 댓글 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS payment_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_request_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_request_id) REFERENCES payment_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 기본

  // AS 요청 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS as_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      client_name TEXT NOT NULL,
      client_phone TEXT,
      description TEXT NOT NULL,
      scheduled_date DATE,
      status TEXT DEFAULT 'pending',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // 업무 요청 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS work_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending',
      assigned_to INTEGER,
      due_date DATE,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // 추가내역 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS additional_works (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      work_date DATE,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // 공사대금 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS construction_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      payment_date DATE,
      payment_method TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // 협력업체 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS contractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      specialty TEXT,
      notes TEXT,
      bank_name TEXT,
      account_number TEXT,
      rank TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add missing columns to contractors table (migration)
  db.run(`ALTER TABLE contractors ADD COLUMN bank_name TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding bank_name column:', err);
    }
  });
  db.run(`ALTER TABLE contractors ADD COLUMN account_number TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding account_number column:', err);
    }
  });
  db.run(`ALTER TABLE contractors ADD COLUMN rank TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding rank column:', err);
    }
  });

  // 기본 계정 생성 (테이블 생성 후 즉시 실행)
  // Use serialize to ensure tables are created before inserting users
  db.serialize(() => {
    const bcrypt = require('bcryptjs');
    const password = bcrypt.hashSync('0109', 10);

    const users = [
      ['상준', password, '상준', 'manager', '관리부'],
      ['신애', password, '신애', 'manager', '관리부'],
      ['재천', password, '재천', 'worker', '시공부'],
      ['민기', password, '민기', 'worker', '시공부'],
      ['재성', password, '재성', 'worker', '시공부'],
      ['재현', password, '재현', 'worker', '시공부']
    ];

    users.forEach(([username, pwd, name, role, dept]) => {
      db.run(
        'INSERT OR IGNORE INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)',
        [username, pwd, name, role, dept],
        (err) => {
          if (err) {
            console.error(`사용자 ${username} 생성 오류:`, err.message);
          } else {
            console.log(`사용자 ${username} 생성 완료`);
          }
        }
      );
    });

    console.log('데이터베이스 초기 사용자 생성 완료');

    // 협력업체 시드 데이터 삽입
    try {
      const contractorsSeed = require('../data/contractors-seed');

      // Check if contractors already exist
      db.get('SELECT COUNT(*) as count FROM contractors', [], (err, row) => {
        if (err) {
          console.error('협력업체 확인 오류:', err);
          return;
        }

        if (row.count === 0) {
          console.log('협력업체 시드 데이터 삽입 시작...');
          let insertedCount = 0;

          contractorsSeed.forEach((contractor) => {
            db.run(
              'INSERT INTO contractors (name, contact_person, phone, specialty, notes, rank) VALUES (?, ?, ?, ?, ?, ?)',
              [contractor.name, contractor.contact_person, contractor.phone, contractor.specialty, contractor.notes, contractor.rank || ''],
              (err) => {
                if (err) {
                  console.error(`협력업체 ${contractor.name} 생성 오류:`, err.message);
                } else {
                  insertedCount++;
                  if (insertedCount % 20 === 0 || insertedCount === contractorsSeed.length) {
                    console.log(`협력업체 ${insertedCount}/${contractorsSeed.length}개 생성 완료`);
                  }
                }
              }
            );
          });
        } else {
          console.log(`데이터베이스에 이미 ${row.count}개의 협력업체가 있습니다.`);
        }
      });
    } catch (err) {
      console.log('협력업체 시드 데이터 파일을 찾을 수 없습니다. 건너뜁니다.');
    }
  });

  console.log('데이터베이스 테이블 초기화 완료');
};

module.exports = { db, initDatabase };