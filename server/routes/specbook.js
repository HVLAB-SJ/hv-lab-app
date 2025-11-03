const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// 이미지 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/specbook/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

// 모든 스펙북 아이템 조회
router.get('/', authenticateToken, (req, res) => {
  const { category } = req.query;

  let query = 'SELECT * FROM specbook_items';
  let params = [];

  if (category && category !== '전체') {
    query += ' WHERE category = ?';
    params.push(category);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('스펙북 아이템 조회 실패:', err);
      return res.status(500).json({ error: '스펙북 아이템 조회 실패' });
    }
    res.json(rows);
  });
});

// 카테고리 목록 조회
router.get('/categories', authenticateToken, (req, res) => {
  db.all(
    'SELECT DISTINCT category FROM specbook_items ORDER BY category',
    [],
    (err, rows) => {
      if (err) {
        console.error('카테고리 조회 실패:', err);
        return res.status(500).json({ error: '카테고리 조회 실패' });
      }
      const categories = ['전체', ...rows.map(row => row.category)];
      res.json(categories);
    }
  );
});

// 새 스펙북 아이템 생성
router.post('/', authenticateToken, isManager, upload.single('image'), (req, res) => {
  const { name, category, description } = req.body;
  const imageUrl = req.file ? `/uploads/specbook/${req.file.filename}` : null;

  if (!name || !category) {
    return res.status(400).json({ error: '이름과 카테고리는 필수입니다.' });
  }

  db.run(
    `INSERT INTO specbook_items (name, category, description, image_url)
     VALUES (?, ?, ?, ?)`,
    [name, category, description || '', imageUrl],
    function(err) {
      if (err) {
        console.error('스펙북 아이템 생성 실패:', err);
        return res.status(500).json({ error: '스펙북 아이템 생성 실패' });
      }

      res.status(201).json({
        id: this.lastID,
        name,
        category,
        description,
        image_url: imageUrl,
        message: '스펙북 아이템이 생성되었습니다.'
      });
    }
  );
});

// 스펙북 아이템 수정
router.put('/:id', authenticateToken, isManager, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, category, description } = req.body;
  const imageUrl = req.file ? `/uploads/specbook/${req.file.filename}` : null;

  let query = 'UPDATE specbook_items SET name = ?, category = ?, description = ?, updated_at = CURRENT_TIMESTAMP';
  let params = [name, category, description || ''];

  if (imageUrl) {
    query += ', image_url = ?';
    params.push(imageUrl);
  }

  query += ' WHERE id = ?';
  params.push(id);

  db.run(query, params, function(err) {
    if (err) {
      console.error('스펙북 아이템 수정 실패:', err);
      return res.status(500).json({ error: '스펙북 아이템 수정 실패' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: '스펙북 아이템을 찾을 수 없습니다.' });
    }

    res.json({ message: '스펙북 아이템이 수정되었습니다.' });
  });
});

// 스펙북 아이템 삭제
router.delete('/:id', authenticateToken, isManager, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM specbook_items WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('스펙북 아이템 삭제 실패:', err);
      return res.status(500).json({ error: '스펙북 아이템 삭제 실패' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: '스펙북 아이템을 찾을 수 없습니다.' });
    }

    res.json({ message: '스펙북 아이템이 삭제되었습니다.' });
  });
});

module.exports = router;
