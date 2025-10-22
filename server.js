require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const { db, initDatabase } = require('./server/config/database');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));

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