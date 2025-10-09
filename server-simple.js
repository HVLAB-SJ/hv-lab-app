require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { db, initDatabase } = require('./server/config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 메인 페이지 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 간단한 테스트 API
app.get('/api/test', (req, res) => {
    res.json({ message: '서버가 정상 작동 중입니다!' });
});

// 404 처리
app.use((req, res) => {
    res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
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