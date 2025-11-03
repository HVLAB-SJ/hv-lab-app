const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// uploads 디렉토리 생성
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'specbook');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 이미지 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

// Base64 이미지 저장 함수
const saveBase64Image = (base64Data) => {
  const matches = base64Data.match(/^data:image\/([a-zA-Z]*);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 image data');
  }

  const imageType = matches[1];
  const imageBuffer = Buffer.from(matches[2], 'base64');
  const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + imageType;
  const filepath = path.join(uploadsDir, filename);

  fs.writeFileSync(filepath, imageBuffer);
  return `/uploads/specbook/${filename}`;
};

// 카테고리 목록
const CATEGORIES = [
  '전체', '변기', '세면대', '수전', '샤워수전', '욕조', '타일', '마루', '도어', '조명',
  '벽지', '페인트', '싱크볼', '가전', '세라믹', '인조대리석', '샤워슬라이드바', '싱크수전',
  '거울', '유리', '환풍기', '실링팬', '칸스톤', '월패널', '옷걸이(후크)', '수건걸이',
  '육가(배수구)', '트렌치(배수구)', '휴지걸이', '주방후드', '스위치', '콘센트', '가구자재',
  '줄눈', '방문손잡이', '필름', '가구손잡이', '기타'
];

// 카테고리 목록 조회
router.get('/categories', authenticateToken, (req, res) => {
  res.json(CATEGORIES);
});

// 스펙북 라이브러리 조회
router.get('/library', authenticateToken, (req, res) => {
  const { category } = req.query;

  let query = 'SELECT * FROM specbook_items WHERE is_library = 1';
  let params = [];

  if (category && category !== '전체') {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('스펙북 라이브러리 조회 실패:', err);
      return res.status(500).json({ error: '스펙북 라이브러리 조회 실패' });
    }
    res.json(rows);
  });
});

// 프로젝트별 스펙 조회
router.get('/project/:projectId', authenticateToken, (req, res) => {
  const { projectId } = req.params;
  const { category } = req.query;

  let query = 'SELECT * FROM specbook_items WHERE project_id = ?';
  let params = [projectId];

  if (category && category !== '전체') {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('프로젝트 스펙 조회 실패:', err);
      return res.status(500).json({ error: '프로젝트 스펙 조회 실패' });
    }
    res.json(rows);
  });
});

// 모든 프로젝트 목록 조회 (스펙북용)
router.get('/projects', authenticateToken, (req, res) => {
  db.all(
    'SELECT id, title FROM projects ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) {
        console.error('프로젝트 목록 조회 실패:', err);
        return res.status(500).json({ error: '프로젝트 목록 조회 실패' });
      }
      res.json(rows);
    }
  );
});

// Base64 이미지로 스펙북 아이템 생성
router.post('/base64', authenticateToken, isManager, (req, res) => {
  const { name, category, brand, price, description, imageData, projectId, isLibrary } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: '이름과 카테고리는 필수입니다.' });
  }

  // imageData를 그대로 DB에 저장 (base64 형식)
  const imageUrl = imageData || null;

  const is_library = isLibrary ? 1 : 0;
  const project_id = projectId || null;

  db.run(
    `INSERT INTO specbook_items (name, category, brand, price, description, image_url, project_id, is_library)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, category, brand || '', price || '', description || '', imageUrl, project_id, is_library],
    function(err) {
      if (err) {
        console.error('스펙북 아이템 생성 실패:', err);
        return res.status(500).json({ error: '스펙북 아이템 생성 실패' });
      }

      res.status(201).json({
        id: this.lastID,
        name,
        category,
        brand,
        price,
        description,
        image_url: imageUrl,
        project_id,
        is_library,
        message: '스펙북 아이템이 생성되었습니다.'
      });
    }
  );
});

// 파일 업로드로 스펙북 아이템 생성
router.post('/', authenticateToken, isManager, upload.single('image'), (req, res) => {
  const { name, category, brand, price, description, projectId, isLibrary } = req.body;
  const imageUrl = req.file ? `/uploads/specbook/${req.file.filename}` : null;

  if (!name || !category) {
    return res.status(400).json({ error: '이름과 카테고리는 필수입니다.' });
  }

  const is_library = isLibrary === 'true' || isLibrary === true ? 1 : 0;
  const project_id = projectId || null;

  db.run(
    `INSERT INTO specbook_items (name, category, brand, price, description, image_url, project_id, is_library)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, category, brand || '', price || '', description || '', imageUrl, project_id, is_library],
    function(err) {
      if (err) {
        console.error('스펙북 아이템 생성 실패:', err);
        return res.status(500).json({ error: '스펙북 아이템 생성 실패' });
      }

      res.status(201).json({
        id: this.lastID,
        name,
        category,
        brand,
        price,
        description,
        image_url: imageUrl,
        project_id,
        is_library,
        message: '스펙북 아이템이 생성되었습니다.'
      });
    }
  );
});

// 스펙북 아이템 수정
router.put('/:id', authenticateToken, isManager, (req, res) => {
  const { id } = req.params;
  const { name, category, brand, price, description, projectId, isLibrary, imageData } = req.body;

  let query = 'UPDATE specbook_items SET name = ?, category = ?, brand = ?, price = ?, description = ?, updated_at = CURRENT_TIMESTAMP';
  let params = [name, category, brand || '', price || '', description || ''];

  if (projectId !== undefined) {
    query += ', project_id = ?';
    params.push(projectId || null);
  }

  if (isLibrary !== undefined) {
    query += ', is_library = ?';
    params.push(isLibrary === 'true' || isLibrary === true ? 1 : 0);
  }

  // imageData가 있으면 base64로 저장
  if (imageData) {
    query += ', image_url = ?';
    params.push(imageData);
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

  // 먼저 이미지 경로 조회
  db.get('SELECT image_url FROM specbook_items WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('스펙북 아이템 조회 실패:', err);
      return res.status(500).json({ error: '스펙북 아이템 조회 실패' });
    }

    // 아이템 삭제
    db.run('DELETE FROM specbook_items WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('스펙북 아이템 삭제 실패:', err);
        return res.status(500).json({ error: '스펙북 아이템 삭제 실패' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '스펙북 아이템을 찾을 수 없습니다.' });
      }

      // 이미지 파일 삭제
      if (row && row.image_url) {
        const imagePath = path.join(__dirname, '..', '..', row.image_url);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      res.json({ message: '스펙북 아이템이 삭제되었습니다.' });
    });
  });
});

module.exports = router;
