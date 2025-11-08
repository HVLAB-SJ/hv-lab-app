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
      time TEXT DEFAULT '-',
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
      description TEXT,
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

  // Add missing columns to as_requests table (migration)
  db.run(`ALTER TABLE as_requests ADD COLUMN request_date DATE`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding request_date column:', err);
    }
  });
  db.run(`ALTER TABLE as_requests ADD COLUMN site_address TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding site_address column:', err);
    }
  });
  db.run(`ALTER TABLE as_requests ADD COLUMN entrance_password TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding entrance_password column:', err);
    }
  });
  db.run(`ALTER TABLE as_requests ADD COLUMN scheduled_visit_date DATE`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding scheduled_visit_date column:', err);
    }
  });
  db.run(`ALTER TABLE as_requests ADD COLUMN scheduled_visit_time TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding scheduled_visit_time column:', err);
    }
  });
  db.run(`ALTER TABLE as_requests ADD COLUMN assigned_to TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding assigned_to column:', err);
    }
  });
  db.run(`ALTER TABLE as_requests ADD COLUMN completion_date DATE`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding completion_date column:', err);
    }
  });
  db.run(`ALTER TABLE as_requests ADD COLUMN notes TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding notes column:', err);
    }
  });

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

  // Add notes column to additional_works table (migration)
  db.run(`ALTER TABLE additional_works ADD COLUMN notes TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding notes column to additional_works:', err);
    } else if (!err) {
      console.log('✓ notes column added to additional_works table');
    }
  });

  // Add images column to additional_works table (migration)
  db.run(`ALTER TABLE additional_works ADD COLUMN images TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding images column to additional_works:', err);
    } else if (!err) {
      console.log('✓ images column added to additional_works table');
    }
  });

  // Clean quotes from all text fields in contractors table (one-time migration)
  db.run(`
    UPDATE contractors SET
      name = REPLACE(name, '"', ''),
      contact_person = REPLACE(contact_person, '"', ''),
      phone = REPLACE(phone, '"', ''),
      email = REPLACE(email, '"', ''),
      specialty = REPLACE(specialty, '"', ''),
      notes = REPLACE(notes, '"', ''),
      bank_name = REPLACE(bank_name, '"', ''),
      account_number = REPLACE(account_number, '"', ''),
      rank = REPLACE(rank, '"', ''),
      position = REPLACE(position, '"', '')
    WHERE name LIKE '%"%'
       OR contact_person LIKE '%"%'
       OR phone LIKE '%"%'
       OR email LIKE '%"%'
       OR specialty LIKE '%"%'
       OR notes LIKE '%"%'
       OR bank_name LIKE '%"%'
       OR account_number LIKE '%"%'
       OR rank LIKE '%"%'
       OR position LIKE '%"%'
  `, function(err) {
    if (err) {
      console.error('❌ Error cleaning quotes from contractors:', err);
    } else if (this.changes > 0) {
      console.log(`✓ Cleaned quotes from ${this.changes} contractor entries`);
    } else {
      console.log('✓ No quotes found in contractors table');
    }
  });

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

  // Add VAT-related columns to construction_payments table (migration)
  db.run(`ALTER TABLE construction_payments ADD COLUMN vat_type TEXT DEFAULT 'percentage'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding vat_type column:', err);
    }
  });
  db.run(`ALTER TABLE construction_payments ADD COLUMN vat_percentage INTEGER DEFAULT 100`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding vat_percentage column:', err);
    }
  });
  db.run(`ALTER TABLE construction_payments ADD COLUMN vat_amount INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding vat_amount column:', err);
    }
  });
  db.run(`ALTER TABLE construction_payments ADD COLUMN payments TEXT DEFAULT '[]'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding payments column:', err);
    }
  });

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

  // 스펙북 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS specbook_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT,
      price TEXT,
      image_url TEXT,
      project_id INTEGER,
      is_library INTEGER DEFAULT 1,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ 스펙북 테이블 생성 실패:', err);
    } else {
      console.log('✓ 스펙북 테이블 생성 완료');
    }
  });

  // 스펙북 카테고리 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS specbook_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ 스펙북 카테고리 테이블 생성 실패:', err);
    } else {
      console.log('✓ 스펙북 카테고리 테이블 생성 완료');

      // 기본 카테고리 삽입 (테이블이 비어있을 경우에만)
      db.get('SELECT COUNT(*) as count FROM specbook_categories', (err, row) => {
        if (!err && row.count === 0) {
          const defaultCategories = [
            '전체', '변기', '세면대', '수전', '샤워수전', '욕조', '타일', '마루', '도어', '조명',
            '벽지', '페인트', '싱크볼', '가전', '세라믹', '인조대리석', '샤워슬라이드바', '싱크수전',
            '거울', '유리', '환풍기', '실링팬', '칸스톤', '월패널', '옷걸이(후크)', '수건걸이',
            '육가(배수구)', '트렌치(배수구)', '휴지걸이', '주방후드', '스위치', '콘센트', '가구자재',
            '줄눈', '방문손잡이', '필름', '가구손잡이', '기타'
          ];

          const stmt = db.prepare('INSERT INTO specbook_categories (name, order_index) VALUES (?, ?)');
          defaultCategories.forEach((category, index) => {
            stmt.run(category, index);
          });
          stmt.finalize();
          console.log('✓ 기본 카테고리 데이터 삽입 완료');
        }
      });
    }
  });

  // 가견적서 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS estimate_previews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      area_size REAL NOT NULL,
      grade TEXT NOT NULL,
      finish_type TEXT,
      bathroom_count INTEGER DEFAULT 1,
      ceiling_height TEXT DEFAULT '표준',
      include_sash INTEGER DEFAULT 0,
      include_floor_heating INTEGER DEFAULT 0,
      include_aircon INTEGER DEFAULT 0,
      base_construction_cost INTEGER,
      fixture_cost INTEGER,
      sash_cost INTEGER,
      heating_cost INTEGER,
      aircon_cost INTEGER,
      total_min_cost INTEGER,
      total_max_cost INTEGER,
      detail_breakdown TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ 가견적서 테이블 생성 실패:', err);
    } else {
      console.log('✓ 가견적서 테이블 생성 완료');
    }
  });

  // 견적문의 테이블
  db.run(`
    CREATE TABLE IF NOT EXISTS quote_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT,
      project_type TEXT,
      budget TEXT,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      is_contacted INTEGER DEFAULT 0,
      email_message_id TEXT,
      content_hash TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add is_contacted column if it doesn't exist (migration)
  db.run(`ALTER TABLE quote_inquiries ADD COLUMN is_contacted INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding is_contacted column:', err);
    }
  });

  // Add content_hash column if it doesn't exist (migration)
  db.run(`ALTER TABLE quote_inquiries ADD COLUMN content_hash TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding content_hash column:', err);
    } else if (!err) {
      console.log('✓ content_hash column added successfully');
    }
  });

  // Add email_message_id column if it doesn't exist (migration)
  db.run(`ALTER TABLE quote_inquiries ADD COLUMN email_message_id TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding email_message_id column:', err);
    }
  });

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
  db.run(`ALTER TABLE contractors ADD COLUMN position TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding position column:', err);
    }
  });

  // Add display_order column to specbook_items table if it doesn't exist
  db.run(`ALTER TABLE specbook_items ADD COLUMN display_order INTEGER DEFAULT 0`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ display_order column already exists in specbook_items');
      } else {
        console.error('❌ Error adding display_order column to specbook_items:', err);
      }
    } else {
      console.log('✓ display_order column added successfully to specbook_items');
    }
  });

  // Add grade column to specbook_items table if it doesn't exist
  db.run(`ALTER TABLE specbook_items ADD COLUMN grade TEXT DEFAULT '기본'`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ grade column already exists in specbook_items');
      } else {
        console.error('❌ Error adding grade column to specbook_items:', err);
      }
    } else {
      console.log('✓ grade column added successfully to specbook_items');
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