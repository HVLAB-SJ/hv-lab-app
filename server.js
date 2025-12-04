require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const cron = require('node-cron');
const { db, initDatabase } = require('./server/config/database');
const emailService = require('./utils/emailService');
const { backupDatabase, ensureBackupDirectory } = require('./server/utils/databaseBackup');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Run migrations
const addOriginalMaterialAmount = require('./server/migrations/add-original-material-amount');
const createQuoteInquiriesTable = require('./server/migrations/create-quote-inquiries-table');
const updateSchedulesProjectNullable = require('./server/migrations/update-schedules-project-nullable');
const addQuoteInquiryFields = require('./server/migrations/add-quote-inquiry-fields');
const addQuoteInquiryContacted = require('./server/migrations/add-quote-inquiry-contacted');
const { addExpectedPaymentDates } = require('./server/migrations/add-expected-payment-dates');
const createKBBankingTokensTable = require('./server/migrations/create-kb-banking-tokens-table');
const addKakaoPayFields = require('./server/migrations/add-kakaopay-fields');
const createSpecbookTable = require('./server/migrations/create-specbook-table');
const addSubImagesColumn = require('./server/migrations/add-sub-images-column');
const addQuoteInquiryDeduplication = require('./server/migrations/add-quote-inquiry-deduplication');
const createSiteLogsTable = require('./server/migrations/create-site-logs-table');
const addQuickTextColumn = require('./server/migrations/add-quick-text-column');
const createDrawingsTable = require('./server/migrations/create-drawings-table');
const addPaymentImagesColumn = require('./server/migrations/add-payment-images-column');
const addExecutionRecordsTable = require('./server/migrations/add-execution-records-table');
const addExecutionRecordImages = require('./server/migrations/add-execution-record-images');
addOriginalMaterialAmount().catch(console.error);
createQuoteInquiriesTable().catch(console.error);
updateSchedulesProjectNullable().catch(console.error);
addQuoteInquiryFields().catch(console.error);
addQuoteInquiryContacted().catch(console.error);
addExpectedPaymentDates().catch(console.error);
createKBBankingTokensTable().catch(console.error);
addKakaoPayFields().catch(console.error);
createSpecbookTable().catch(console.error);
addSubImagesColumn().catch(console.error);
addQuoteInquiryDeduplication().catch(console.error);
createSiteLogsTable().catch(console.error);
addQuickTextColumn().catch(console.error);
createDrawingsTable().catch(console.error);
addPaymentImagesColumn().catch(console.error);
addExecutionRecordsTable(require('./server/config/database').db).catch(console.error);
// 실행내역 테이블 생성 후 images 컬럼 추가
setTimeout(() => {
  addExecutionRecordImages(require('./server/config/database').db).catch(console.error);
}, 500);

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

console.log(`Port configuration: ${PORT}`);
console.log(`CORS Origin: ${CORS_ORIGIN}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// 미들웨어 설정
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));
app.use(express.json({ limit: '200mb' })); // Increase limit for large image uploads
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// 정적 파일 제공 - PUBLIC 폴더에서만 제공
// 모든 프론트엔드 빌드 파일은 public 폴더에 있어야 함
app.use(express.static(path.join(__dirname, 'public')));

// views 폴더 (필요시)
app.use(express.static(path.join(__dirname, 'views')));

// uploads 폴더 제공 (스펙북 이미지 등)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Railway Volume 경로 제공 (도면 이미지 등)
const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH;
if (volumePath) {
  app.use('/data', express.static(volumePath));
  console.log('📁 Railway Volume 정적 파일 제공:', volumePath);
}

// io 인스턴스를 app에 설정 (라우트에서 접근 가능)
app.set('io', io);

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log('새로운 클라이언트 연결:', socket.id);

  // 프로젝트별 룸 참여
  socket.on('join-project', (projectId) => {
    socket.join(`project-${projectId}`);
    console.log(`클라이언트 ${socket.id}가 프로젝트 ${projectId}에 참여`);
  });

  // 일정 업데이트 브로드캐스트
  socket.on('schedule-update', (data) => {
    socket.to(`project-${data.projectId}`).emit('schedule-updated', data);
  });

  // 새 일정 추가 브로드캐스트
  socket.on('schedule-add', (data) => {
    socket.to(`project-${data.projectId}`).emit('schedule-added', data);
  });

  // 일정 삭제 브로드캐스트
  socket.on('schedule-delete', (data) => {
    socket.to(`project-${data.projectId}`).emit('schedule-deleted', data);
  });

  // 댓글 추가 브로드캐스트
  socket.on('comment-add', (data) => {
    socket.to(`project-${data.projectId}`).emit('comment-added', data);
  });

  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제:', socket.id);
  });
});

// API 라우트들을 위한 준비
const authRoutes = require('./server/routes/auth');
const projectRoutes = require('./server/routes/projects');
const scheduleRoutes = require('./server/routes/schedules');
const userRoutes = require('./server/routes/users');
const paymentRoutes = require('./server/routes/payments');
const oauthRoutes = require('./server/routes/oauth');
const asRequestsRoutes = require('./server/routes/asrequests');
const workRequestsRoutes = require('./server/routes/workrequests');
const additionalWorksRoutes = require('./server/routes/additionalworks');
const constructionPaymentsRoutes = require('./server/routes/constructionpayments');
const contractorsRoutes = require('./server/routes/contractors');
const bankingRoutes = require('./server/routes/banking');
const testRoutes = require('./server/routes/test');
const quoteInquiriesRoutes = require('./server/routes/quoteInquiries');
const adminRoutes = require('./server/routes/admin');
const specbookRoutes = require('./server/routes/specbook');
const estimatePreviewRoutes = require('./server/routes/estimate-preview');
const finishCheckRoutes = require('./server/routes/finish-check');
const siteLogsRoutes = require('./server/routes/siteLogs');
const drawingsRoutes = require('./server/routes/drawings');
const executionRecordsRoutes = require('./server/routes/executionRecords');

// API 라우트 설정
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/oauth', oauthRoutes);
app.use('/api/as-requests', asRequestsRoutes);
app.use('/api/workrequests', workRequestsRoutes);
app.use('/api/additional-works', additionalWorksRoutes);
app.use('/api/construction-payments', constructionPaymentsRoutes);
app.use('/api/contractors', contractorsRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/test', testRoutes); // 테스트 라우트 추가
app.use('/api/quote-inquiries', quoteInquiriesRoutes);
app.use('/api/admin', adminRoutes); // 관리자 라우트 추가
app.use('/api/specbook', specbookRoutes); // 스펙북 라우트 추가
app.use('/api/finish-check', finishCheckRoutes); // 마감체크 라우트 추가
app.use('/api/estimate-preview', estimatePreviewRoutes); // 가견적서 라우트 추가
app.use('/api/site-logs', siteLogsRoutes); // 현장일지 라우트 추가
app.use('/api/drawings', drawingsRoutes); // 도면 라우트 추가
app.use('/api/execution-records', executionRecordsRoutes); // 실행내역 라우트 추가


// 로그인 페이지 라우트
app.get('/login', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 헬스체크 라우트
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: '서버가 정상 작동 중입니다.' });
});

// 메인 페이지는 정적 파일 (public/index.html)로 제공됨

// SPA fallback - HTML 요청은 index.html로, API 요청은 404 JSON으로
app.use((req, res) => {
  // API 요청인 경우 JSON 에러 반환
  if (req.path.startsWith('/api/') || req.path.startsWith('/oauth/')) {
    return res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
  }

  // HTML 요청인 경우 React app (public/index.html) 반환
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// 서버 시작
const HOST = '0.0.0.0';
server.listen(PORT, HOST, async () => {
  console.log(`서버가 ${HOST}:${PORT}에서 실행 중입니다.`);
  console.log(`http://localhost:${PORT}`);

  // 데이터베이스 초기화
  initDatabase();

  // Add time column to schedules table
  setTimeout(() => {
    console.log('🔄 Checking schedules table for time column...');
    db.all('PRAGMA table_info(schedules)', (err, columns) => {
      if (err) {
        console.error('❌ Error checking schedules table schema:', err);
        return;
      }

      const hasTimeColumn = columns && columns.some(col => col.name === 'time');

      if (!hasTimeColumn) {
        console.log('⚠️  Time column not found, adding it now...');
        db.run(`ALTER TABLE schedules ADD COLUMN time TEXT DEFAULT '-'`, (err) => {
          if (err) {
            console.error('❌ Error adding time column:', err.message);
          } else {
            console.log('✅ Successfully added time column to schedules table');
          }
        });
      } else {
        console.log('✅ Time column already exists in schedules table');
      }
    });
  }, 100);

  // Run payment_requests table migration for new columns
  setTimeout(() => {
    console.log('🔄 Checking payment_requests table for new columns...');

    // Check and add missing columns to payment_requests table
    const paymentColumns = [
      { name: 'item_name', type: 'TEXT' },
      { name: 'material_amount', type: 'INTEGER DEFAULT 0' },
      { name: 'labor_amount', type: 'INTEGER DEFAULT 0' },
      { name: 'original_labor_amount', type: 'INTEGER DEFAULT 0' },
      { name: 'apply_tax_deduction', type: 'INTEGER DEFAULT 0' },
      { name: 'includes_vat', type: 'INTEGER DEFAULT 0' }
    ];

    paymentColumns.forEach(column => {
      db.all('PRAGMA table_info(payment_requests)', (err, columns) => {
        if (err) {
          console.error('❌ Error checking payment_requests table:', err);
          return;
        }

        const hasColumn = columns && columns.some(col => col.name === column.name);

        if (!hasColumn) {
          console.log(`⚠️  Column ${column.name} not found in payment_requests, adding it now...`);
          db.run(`ALTER TABLE payment_requests ADD COLUMN ${column.name} ${column.type}`, (err) => {
            if (err) {
              console.error(`❌ Error adding ${column.name} column:`, err.message);
            } else {
              console.log(`✅ Successfully added ${column.name} column to payment_requests table`);
            }
          });
        } else {
          console.log(`✅ Column ${column.name} already exists in payment_requests table`);
        }
      });
    });
  }, 200);

  // Run work_requests table migration
  setTimeout(() => {
    console.log('🔄 Checking work_requests table schema...');

    // Function to check if column exists
    const columnExists = (columnName, callback) => {
      db.all('PRAGMA table_info(work_requests)', (err, columns) => {
        if (err) {
          callback(err, false);
          return;
        }
        const exists = columns && columns.some(col => col.name === columnName);
        callback(null, exists);
      });
    };

    // Add column if it doesn't exist
    const addColumnIfNeeded = (columnName, columnType, callback) => {
      columnExists(columnName, (err, exists) => {
        if (err) {
          console.error(`❌ Error checking ${columnName}:`, err);
          callback(err);
          return;
        }
        if (exists) {
          console.log(`✅ Column '${columnName}' already exists`);
          callback(null);
          return;
        }
        db.run(`ALTER TABLE work_requests ADD COLUMN ${columnName} ${columnType}`, (err) => {
          if (err) {
            console.error(`❌ Error adding ${columnName}:`, err);
            callback(err);
            return;
          }
          console.log(`✅ Added column '${columnName}' (${columnType})`);
          callback(null);
        });
      });
    };

    // Add all required columns
    const columnsToAdd = [
      { name: 'project', type: 'TEXT' },
      { name: 'request_date', type: 'DATE' },
      { name: 'request_type', type: 'TEXT' },
      { name: 'requested_by', type: 'TEXT' }
    ];

    let currentIndex = 0;
    const addNextColumn = () => {
      if (currentIndex >= columnsToAdd.length) {
        console.log('✅ work_requests migration completed');
        return;
      }
      const column = columnsToAdd[currentIndex];
      addColumnIfNeeded(column.name, column.type, (err) => {
        if (!err) {
          currentIndex++;
          addNextColumn();
        }
      });
    };

    addNextColumn();
  }, 1000);

  // Ensure at least one admin user exists (for Railway ephemeral storage)
  setTimeout(() => {
    db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
      if (err) {
        console.error('사용자 확인 오류:', err);
        return;
      }

      if (result.count === 0) {
        console.log('⚠️  사용자가 없습니다. 기본 사용자를 다시 생성합니다...');
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
                console.log(`✅ 사용자 ${username} 생성 완료`);
              }
            }
          );
        });
      } else {
        console.log(`✅ 데이터베이스에 ${result.count}명의 사용자가 있습니다.`);

        // Migration: Fix user names to remove surnames (for existing Railway database)
        const nameUpdates = [
          { username: '상준', correctName: '상준' },
          { username: '신애', correctName: '신애' },
          { username: '재천', correctName: '재천' },
          { username: '민기', correctName: '민기' },
          { username: '재성', correctName: '재성' },
          { username: '재현', correctName: '재현' }
        ];

        nameUpdates.forEach(({ username, correctName }) => {
          db.get('SELECT name FROM users WHERE username = ?', [username], (err, row) => {
            if (!err && row && row.name !== correctName) {
              db.run('UPDATE users SET name = ? WHERE username = ?', [correctName, username], (err) => {
                if (!err) {
                  console.log(`✅ Fixed user name: ${row.name} -> ${correctName}`);
                }
              });
            }
          });
        });
      }
    });
  }, 2000); // Wait for tables to be created

  // 이메일 체크 스케줄러 - 5분마다 실행
  console.log('📧 이메일 체크 스케줄러를 시작합니다 (5분마다 실행)');
  cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ [스케줄러] 견적문의 메일 확인 중...');
    try {
      const newInquiries = await emailService.checkNewQuoteInquiries();
      if (newInquiries && newInquiries.length > 0) {
        console.log(`✅ [스케줄러] ${newInquiries.length}개의 새로운 견적문의가 등록되었습니다.`);
        // Socket.IO로 실시간 알림 전송 (추후 구현)
        // io.emit('new-quote-inquiry', { count: newInquiries.length });
      }
    } catch (error) {
      console.error('❌ [스케줄러] 이메일 확인 중 오류:', error.message);
    }
  });

  // 서버 시작 시 한 번 실행
  setTimeout(async () => {
    console.log('📧 서버 시작 시 견적문의 메일 확인...');
    try {
      const newInquiries = await emailService.checkNewQuoteInquiries();
      if (newInquiries && newInquiries.length > 0) {
        console.log(`✅ ${newInquiries.length}개의 새로운 견적문의가 등록되었습니다.`);
      }
    } catch (error) {
      console.error('❌ 초기 이메일 확인 중 오류:', error.message);
    }
  }, 5000); // 서버 시작 5초 후 실행

  // ========================================
  // 데이터베이스 자동 백업 설정
  // ========================================

  // 백업 디렉토리 초기화
  ensureBackupDirectory();

  // 매일 자정(00:00)에 자동 백업 실행
  console.log('💾 데이터베이스 자동 백업 스케줄러를 시작합니다 (매일 00:00 실행)');
  cron.schedule('0 0 * * *', () => {
    console.log('⏰ [백업 스케줄러] 데이터베이스 자동 백업 시작...');
    const success = backupDatabase();
    if (success) {
      console.log('✅ [백업 스케줄러] 백업 완료');
    } else {
      console.error('❌ [백업 스케줄러] 백업 실패');
    }
  });

  // 서버 시작 시 즉시 백업 실행 (초기 백업)
  setTimeout(() => {
    console.log('💾 서버 시작 시 초기 백업 수행...');
    const success = backupDatabase();
    if (success) {
      console.log('✅ 초기 백업 완료');
    } else {
      console.error('❌ 초기 백업 실패');
    }
  }, 3000); // 서버 시작 3초 후 실행
});

// 우아한 종료 처리
process.on('SIGINT', () => {
  console.log('\n서버를 종료합니다...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('데이터베이스 연결이 종료되었습니다.');
    process.exit(0);
  });
});

module.exports = { app, io };