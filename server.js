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
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 3000;
console.log(`Port configuration: ${PORT}`);

// 미들웨어 설정
app.use(cors());
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

// API 라우트 설정
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/oauth', oauthRoutes);

// 헬스체크 라우트
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: '서버가 정상 작동 중입니다.' });
});

// 메인 페이지는 정적 파일 (views/index.html)로 제공됨

// SPA fallback - HTML 요청은 index.html로, API 요청은 404 JSON으로
app.use((req, res) => {
  // API 요청인 경우 JSON 에러 반환
  if (req.path.startsWith('/api/') || req.path.startsWith('/oauth/')) {
    return res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
  }

  // HTML 요청인 경우 index.html 반환 (SPA 라우팅)
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// 서버 시작
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`서버가 ${HOST}:${PORT}에서 실행 중입니다.`);
  console.log(`http://localhost:${PORT}`);

  // 데이터베이스 초기화
  initDatabase();
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