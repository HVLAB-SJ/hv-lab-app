const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

// 로그인
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: '서버 오류' });
      }

      if (!user) {
        return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
      }

      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role  // Use actual role for authorization
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.SESSION_EXPIRE || '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,  // Return actual role
          department: user.department
        }
      });
    }
  );
});

// 토큰 검증
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ valid: false });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ valid: false });
    }
    res.json({ valid: true, user });
  });
});

// 현재 로그인 사용자 정보 조회
router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }

    db.get(
      'SELECT id, username, name, role, department, phone, email FROM users WHERE id = ?',
      [decoded.id],
      (err, user) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            department: user.department,
            phone: user.phone,
            email: user.email
          }
        });
      }
    );
  });
});

module.exports = router;
