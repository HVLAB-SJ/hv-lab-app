const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 카테고리 파일 경로
const CATEGORIES_FILE = path.join(__dirname, '..', 'data', 'categories.json');

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

// Base64 이미지 검증 함수
const validateBase64Image = (base64Data) => {
  const matches = base64Data.match(/^data:image\/([a-zA-Z]*);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 image data');
  }
  return base64Data; // 유효한 base64 데이터를 그대로 반환
};

// Base64 파일 검증 함수 (이미지, PDF, 문서 등 모든 파일 지원)
const validateBase64File = (base64Data) => {
  // 파일명|base64 형식인 경우 파일명 분리
  if (base64Data.includes('|data:')) {
    const parts = base64Data.split('|');
    if (parts.length === 2) {
      const actualData = parts[1];
      const matches = actualData.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid base64 file data');
      }
      return base64Data;
    }
  }
  // 일반 base64 형식
  const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 file data');
  }
  return base64Data;
};

// 파일을 Base64로 변환하는 함수
const fileToBase64 = (filePath, mimeType) => {
  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');
  return `data:${mimeType};base64,${base64Data}`;
};

// 기본 카테고리 목록
const DEFAULT_CATEGORIES = [
  '전체', '변기', '세면대', '수전', '샤워수전', '욕조', '타일', '마루', '도어', '조명',
  '벽지', '페인트', '싱크볼', '가전', '세라믹', '인조대리석', '샤워슬라이드바', '싱크수전',
  '거울', '유리', '환풍기', '실링팬', '칸스톤', '월패널', '옷걸이(후크)', '수건걸이',
  '육가(배수구)', '트렌치(배수구)', '휴지걸이', '주방후드', '스위치', '콘센트', '가구자재',
  '줄눈', '방문손잡이', '필름', '가구손잡이', '기타'
];

// 카테고리를 데이터베이스에서 읽기
const loadCategories = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT name FROM specbook_categories ORDER BY order_index', (err, rows) => {
      if (err) {
        console.error('카테고리 로드 실패:', err);
        resolve(DEFAULT_CATEGORIES);
      } else {
        const categories = rows.map(row => row.name);
        resolve(categories.length > 0 ? categories : DEFAULT_CATEGORIES);
      }
    });
  });
};

// 카테고리를 데이터베이스에 저장
const saveCategories = (categories) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 트랜잭션 시작
      db.run('BEGIN TRANSACTION');

      // 기존 카테고리 모두 삭제
      db.run('DELETE FROM specbook_categories', (err) => {
        if (err) {
          db.run('ROLLBACK');
          console.error('카테고리 삭제 실패:', err);
          resolve(false);
          return;
        }

        // 새 카테고리 삽입
        const stmt = db.prepare('INSERT INTO specbook_categories (name, order_index) VALUES (?, ?)');
        let insertError = false;

        categories.forEach((category, index) => {
          stmt.run(category, index, (err) => {
            if (err) {
              insertError = true;
              console.error('카테고리 삽입 실패:', err);
            }
          });
        });

        stmt.finalize(() => {
          if (insertError) {
            db.run('ROLLBACK');
            resolve(false);
          } else {
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('커밋 실패:', err);
                resolve(false);
              } else {
                resolve(true);
              }
            });
          }
        });
      });
    });
  });
};

// 카테고리 목록 조회
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await loadCategories();
    res.json(categories);
  } catch (error) {
    console.error('카테고리 조회 오류:', error);
    res.status(500).json({ error: '카테고리 조회에 실패했습니다.' });
  }
});

// 카테고리 목록 업데이트
router.put('/categories', authenticateToken, async (req, res) => {
  const { categories } = req.body;

  if (!categories || !Array.isArray(categories)) {
    return res.status(400).json({ error: '카테고리 배열이 필요합니다.' });
  }

  if (!categories.includes('전체')) {
    return res.status(400).json({ error: '전체 카테고리는 필수입니다.' });
  }

  try {
    const success = await saveCategories(categories);
    if (success) {
      res.json({ message: '카테고리가 저장되었습니다.', categories });
    } else {
      res.status(500).json({ error: '카테고리 저장에 실패했습니다.' });
    }
  } catch (error) {
    console.error('카테고리 저장 오류:', error);
    res.status(500).json({ error: '카테고리 저장에 실패했습니다.' });
  }
});

// 스펙북 라이브러리 조회
router.get('/library', authenticateToken, (req, res) => {
  const { category, grades } = req.query;

  let query = 'SELECT * FROM specbook_items WHERE is_library = 1';
  let params = [];

  if (category && category !== '전체') {
    query += ' AND category = ?';
    params.push(category);
  }

  // grades는 쉼표로 구분된 문자열로 전달됨 (예: "기본,고급")
  // 각 아이템의 grade도 쉼표로 구분된 여러 값을 가질 수 있음
  if (grades) {
    const gradeList = grades.split(',').filter(g => g);
    if (gradeList.length > 0) {
      const gradeConditions = gradeList.map(() => `(grade LIKE ? OR grade LIKE ? OR grade LIKE ? OR grade = ?)`).join(' OR ');
      query += ` AND (${gradeConditions})`;
      gradeList.forEach(grade => {
        params.push(`${grade},%`, `%,${grade},%`, `%,${grade}`, grade);
      });
    }
  }

  query += ' ORDER BY category ASC, display_order ASC, created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('스펙북 라이브러리 조회 실패:', err);
      return res.status(500).json({ error: '스펙북 라이브러리 조회 실패' });
    }

    // sub_images JSON 파싱
    const parsedRows = rows.map(row => {
      if (row.sub_images) {
        try {
          row.sub_images = JSON.parse(row.sub_images);
        } catch (e) {
          row.sub_images = [];
        }
      } else {
        row.sub_images = [];
      }
      return row;
    });

    res.json(parsedRows);
  });
});

// 프로젝트별 스펙 조회
router.get('/project/:projectId', authenticateToken, (req, res) => {
  const { projectId } = req.params;
  const { category, grades } = req.query;

  let query = 'SELECT * FROM specbook_items WHERE project_id = ?';
  let params = [projectId];

  if (category && category !== '전체') {
    query += ' AND category = ?';
    params.push(category);
  }

  // grades는 쉼표로 구분된 문자열로 전달됨
  // 각 아이템의 grade도 쉼표로 구분된 여러 값을 가질 수 있음
  if (grades) {
    const gradeList = grades.split(',').filter(g => g);
    if (gradeList.length > 0) {
      const gradeConditions = gradeList.map(() => `(grade LIKE ? OR grade LIKE ? OR grade LIKE ? OR grade = ?)`).join(' OR ');
      query += ` AND (${gradeConditions})`;
      gradeList.forEach(grade => {
        params.push(`${grade},%`, `%,${grade},%`, `%,${grade}`, grade);
      });
    }
  }

  query += ' ORDER BY category ASC, display_order ASC, created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('프로젝트 스펙 조회 실패:', err);
      return res.status(500).json({ error: '프로젝트 스펙 조회 실패' });
    }

    // sub_images JSON 파싱
    const parsedRows = rows.map(row => {
      if (row.sub_images) {
        try {
          row.sub_images = JSON.parse(row.sub_images);
        } catch (e) {
          row.sub_images = [];
        }
      } else {
        row.sub_images = [];
      }
      return row;
    });

    res.json(parsedRows);
  });
});

// 모든 프로젝트 목록 조회 (스펙북용)
router.get('/projects', authenticateToken, (req, res) => {
  db.all(
    'SELECT id, name as title FROM projects ORDER BY created_at DESC',
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
  const { name, category, brand, price, description, imageData, image_url, projectId, isLibrary, grade } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: '이름과 카테고리는 필수입니다.' });
  }

  let imageUrl = image_url || null; // 기존 image_url을 먼저 사용

  // imageData가 있으면 검증 후 저장
  if (imageData) {
    try {
      imageUrl = validateBase64Image(imageData); // base64 데이터를 그대로 저장
    } catch (error) {
      console.error('이미지 검증 실패:', error);
      return res.status(400).json({ error: '이미지 검증 실패' });
    }
  }

  const is_library = isLibrary ? 1 : 0;
  const project_id = projectId || null;
  const item_grade = grade || '기본'; // 기본값 설정

  db.run(
    `INSERT INTO specbook_items (name, category, brand, price, description, image_url, project_id, is_library, grade)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, category, brand || '', price || '', description || '', imageUrl, project_id, is_library, item_grade],
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
        grade: item_grade,
        message: '스펙북 아이템이 생성되었습니다.'
      });
    }
  );
});

// 파일 업로드로 스펙북 아이템 생성
router.post('/', authenticateToken, isManager, upload.single('image'), (req, res) => {
  const { name, category, brand, price, description, projectId, isLibrary } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: '이름과 카테고리는 필수입니다.' });
  }

  // 업로드된 파일을 base64로 변환
  let imageUrl = null;
  if (req.file) {
    try {
      const filePath = path.join(uploadsDir, req.file.filename);
      imageUrl = fileToBase64(filePath, req.file.mimetype);
      // 임시 파일 삭제
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('이미지 변환 실패:', error);
      return res.status(500).json({ error: '이미지 변환 실패' });
    }
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

// Base64 이미지로 스펙북 아이템 수정
router.put('/base64/:id', authenticateToken, isManager, (req, res) => {
  const { id } = req.params;
  const { name, category, brand, price, description, imageData, projectId, isLibrary, grade } = req.body;

  let imageUrl = null;
  if (imageData) {
    try {
      imageUrl = validateBase64Image(imageData); // base64 데이터를 그대로 저장
    } catch (error) {
      console.error('이미지 검증 실패:', error);
      return res.status(400).json({ error: '이미지 검증 실패' });
    }
  }

  let query = 'UPDATE specbook_items SET name = ?, category = ?, brand = ?, price = ?, description = ?, updated_at = CURRENT_TIMESTAMP';
  let params = [name, category, brand || '', price || '', description || ''];

  if (projectId !== undefined) {
    query += ', project_id = ?';
    params.push(projectId || null);
  }

  if (isLibrary !== undefined) {
    query += ', is_library = ?';
    params.push(isLibrary === true || isLibrary === 1 ? 1 : 0);
  }

  if (grade !== undefined) {
    query += ', grade = ?';
    params.push(grade);
  }

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

// 스펙북 아이템 수정 (파일 업로드)
router.put('/:id', authenticateToken, isManager, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, category, brand, price, description, projectId, isLibrary } = req.body;

  // 업로드된 파일을 base64로 변환
  let imageUrl = null;
  if (req.file) {
    try {
      const filePath = path.join(uploadsDir, req.file.filename);
      imageUrl = fileToBase64(filePath, req.file.mimetype);
      // 임시 파일 삭제
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('이미지 변환 실패:', error);
      return res.status(500).json({ error: '이미지 변환 실패' });
    }
  }

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

  // 아이템 삭제 (base64 데이터는 DB에서만 삭제하면 됨)
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

// 스펙북 아이템 순서 업데이트
router.put('/reorder', authenticateToken, isManager, (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: '아이템 배열이 필요합니다.' });
  }

  // 트랜잭션을 위한 serialize 사용
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    let success = true;
    let completedCount = 0;

    items.forEach((item, index) => {
      db.run(
        'UPDATE specbook_items SET display_order = ? WHERE id = ?',
        [index, item.id],
        function(err) {
          if (err) {
            console.error('아이템 순서 업데이트 실패:', err);
            success = false;
          }

          completedCount++;

          // 모든 업데이트가 완료되면 커밋 또는 롤백
          if (completedCount === items.length) {
            if (success) {
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('커밋 실패:', err);
                  res.status(500).json({ error: '순서 업데이트 실패' });
                } else {
                  res.json({ message: '아이템 순서가 업데이트되었습니다.' });
                }
              });
            } else {
              db.run('ROLLBACK', () => {
                res.status(500).json({ error: '순서 업데이트 실패' });
              });
            }
          }
        }
      );
    });
  });
});

// Sub 이미지 업데이트
router.put('/:id/sub-images', authenticateToken, isManager, (req, res) => {
  const { id } = req.params;
  const { sub_images } = req.body;

  if (!sub_images || !Array.isArray(sub_images)) {
    return res.status(400).json({ error: 'sub_images 배열이 필요합니다.' });
  }

  // 각 파일이 유효한 base64인지 검증 (이미지, PDF, 문서 등 모든 파일 지원)
  try {
    sub_images.forEach((img) => {
      if (img) validateBase64File(img);
    });
  } catch (error) {
    console.error('Sub 파일 검증 실패:', error);
    return res.status(400).json({ error: 'Sub 파일 검증 실패' });
  }

  // JSON 문자열로 변환하여 저장
  const sub_images_json = JSON.stringify(sub_images);

  db.run(
    'UPDATE specbook_items SET sub_images = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [sub_images_json, id],
    function(err) {
      if (err) {
        console.error('Sub 이미지 업데이트 실패:', err);
        return res.status(500).json({ error: 'Sub 이미지 업데이트 실패' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '스펙북 아이템을 찾을 수 없습니다.' });
      }

      res.json({ message: 'Sub 이미지가 업데이트되었습니다.' });
    }
  );
});

module.exports = router;
