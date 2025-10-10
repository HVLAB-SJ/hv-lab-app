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

// 메인 페이지 라우트 - HTML을 직접 반환
app.get('/', (req, res) => {
  console.log('Main page requested');

  // 간단하게 HTML을 직접 반환하여 테스트
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HV LAB 현장 관리 시스템</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .login-container {
            background: white;
            padding: 3rem;
            border-radius: 1rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 400px;
        }

        .logo {
            text-align: center;
            margin-bottom: 2rem;
        }

        .logo h1 {
            color: #667eea;
            font-size: 2rem;
            font-weight: 700;
        }

        .logo p {
            color: #666;
            margin-top: 0.5rem;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        label {
            display: block;
            color: #333;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }

        input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: 0.5rem;
            font-size: 1rem;
            transition: border-color 0.3s;
        }

        input:focus {
            outline: none;
            border-color: #667eea;
        }

        .btn {
            width: 100%;
            padding: 0.75rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 0.5rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .btn:hover {
            transform: translateY(-2px);
        }

        .error-message {
            color: #e53e3e;
            text-align: center;
            margin-top: 1rem;
            display: none;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>HV LAB</h1>
            <p>현장 관리 시스템</p>
        </div>

        <form id="loginForm">
            <div class="form-group">
                <label for="username">사용자명</label>
                <input type="text" id="username" name="username" required>
            </div>

            <div class="form-group">
                <label for="password">비밀번호</label>
                <input type="password" id="password" name="password" required>
            </div>

            <button type="submit" class="btn">로그인</button>

            <div id="errorMessage" class="error-message"></div>
        </form>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('errorMessage');

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = '/dashboard.html';
                } else {
                    errorMessage.textContent = data.message || '로그인에 실패했습니다.';
                    errorMessage.style.display = 'block';
                }
            } catch (error) {
                console.error('Login error:', error);
                errorMessage.textContent = '서버 연결에 실패했습니다.';
                errorMessage.style.display = 'block';
            }
        });
    </script>
</body>
</html>
  `;

  res.type('html').send(html);
});

// 404 처리
app.use((req, res) => {
  res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
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