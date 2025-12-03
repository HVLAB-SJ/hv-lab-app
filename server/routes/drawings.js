const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// UUID 대체 함수
const generateId = () => {
  return crypto.randomBytes(16).toString('hex');
};

// 업로드 디렉토리 설정 (Railway Volume 또는 로컬)
const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || '';
const uploadDir = volumePath
  ? path.join(volumePath, 'drawings')  // Railway Volume 사용
  : path.join(__dirname, '../../uploads/drawings');  // 로컬 개발용

console.log('📁 도면 업로드 디렉토리:', uploadDir);
console.log('📁 Railway Volume 사용:', volumePath ? 'Yes' : 'No');

// 디렉토리가 없으면 생성
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('✅ drawings 업로드 디렉토리 생성:', uploadDir);
  }
} catch (mkdirErr) {
  console.error('❌ 업로드 디렉토리 생성 실패:', mkdirErr.message);
}

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `drawing-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB 제한
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('이미지 파일만 업로드 가능합니다 (jpeg, jpg, png, gif, webp)'));
  }
});

// 테이블 존재 여부 확인 및 생성
let tableChecked = false;
const ensureTableExists = () => {
  return new Promise((resolve, reject) => {
    if (tableChecked) {
      resolve();
      return;
    }

    // 먼저 테이블이 존재하는지 확인
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='drawings'", (checkErr, row) => {
      if (checkErr) {
        console.error('[drawings] Error checking table existence:', checkErr);
        reject(checkErr);
        return;
      }

      if (row) {
        // 테이블이 이미 존재함 - 컬럼 확인 및 마이그레이션
        console.log('✅ drawings table already exists, checking columns...');

        // 테이블 구조 확인
        db.all("PRAGMA table_info(drawings)", (pragmaErr, columns) => {
          if (pragmaErr) {
            console.error('[drawings] Error checking table columns:', pragmaErr);
            reject(pragmaErr);
            return;
          }

          const columnNames = columns.map(col => col.name);
          console.log('[drawings] Existing columns:', columnNames);

          // 필요한 컬럼 목록
          const requiredColumns = [
            { name: 'type', sql: "ALTER TABLE drawings ADD COLUMN type TEXT DEFAULT '기본도면'" },
            { name: 'naver_type_sqm', sql: "ALTER TABLE drawings ADD COLUMN naver_type_sqm TEXT" },
            { name: 'naver_type_pyeong', sql: "ALTER TABLE drawings ADD COLUMN naver_type_pyeong TEXT" },
            { name: 'naver_area', sql: "ALTER TABLE drawings ADD COLUMN naver_area TEXT" }
          ];

          // 누락된 컬럼 추가
          const missingColumns = requiredColumns.filter(col => !columnNames.includes(col.name));

          if (missingColumns.length === 0) {
            console.log('[drawings] All required columns exist');
            tableChecked = true;
            resolve();
            return;
          }

          console.log('[drawings] Adding missing columns:', missingColumns.map(c => c.name));

          // 순차적으로 컬럼 추가
          const addColumns = missingColumns.reduce((promise, col) => {
            return promise.then(() => {
              return new Promise((res, rej) => {
                db.run(col.sql, (err) => {
                  if (err) {
                    console.error(`[drawings] Failed to add column ${col.name}:`, err);
                    // 컬럼이 이미 존재하면 무시
                    if (err.message.includes('duplicate column')) {
                      res();
                    } else {
                      rej(err);
                    }
                  } else {
                    console.log(`[drawings] Added column: ${col.name}`);
                    res();
                  }
                });
              });
            });
          }, Promise.resolve());

          addColumns
            .then(() => {
              console.log('[drawings] Migration completed');
              tableChecked = true;
              resolve();
            })
            .catch(reject);
        });
        return;
      }

      // 테이블이 없으면 생성
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS drawings (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          type TEXT NOT NULL,
          image_url TEXT,
          markers TEXT DEFAULT '[]',
          rooms TEXT DEFAULT '[]',
          naver_type_sqm TEXT,
          naver_type_pyeong TEXT,
          naver_area TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, type)
        )
      `;

      db.run(createTableQuery, (err) => {
        if (err) {
          console.error('[drawings] Failed to create table:', err);
          reject(err);
          return;
        }
        console.log('✅ drawings table created');
        tableChecked = true;
        resolve();
      });
    });
  });
};

// 이미지 업로드 엔드포인트
router.post('/upload', authenticateToken, (req, res, next) => {
  console.log('[drawings] Upload request received');
  console.log('[drawings] Upload directory:', uploadDir);
  console.log('[drawings] Directory exists:', fs.existsSync(uploadDir));

  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('[drawings] Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: '파일 크기가 20MB를 초과합니다' });
      }
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.file) {
        console.error('[drawings] No file in request');
        return res.status(400).json({ error: '이미지 파일이 필요합니다' });
      }

      // Railway Volume 사용 시 경로 조정
      const imageUrl = volumePath
        ? `/data/drawings/${req.file.filename}`  // Volume 경로
        : `/uploads/drawings/${req.file.filename}`;  // 로컬 경로

      console.log(`[drawings] Image uploaded: ${imageUrl}, size: ${Math.round(req.file.size / 1024)}KB`);
      console.log(`[drawings] File path: ${req.file.path}`);

      res.json({
        success: true,
        imageUrl: imageUrl,
        filename: req.file.filename,
        size: req.file.size
      });
    } catch (err) {
      console.error('[drawings] Upload error:', err);
      res.status(500).json({ error: '이미지 업로드 실패', details: err.message });
    }
  });
});

// 도면 조회 (projectId, type으로 조회)
router.get('/:projectId/:type', authenticateToken, async (req, res) => {
  const { projectId, type } = req.params;
  const decodedType = decodeURIComponent(type);

  console.log(`[drawings] GET request - projectId: ${projectId}, type: ${decodedType}`);

  try {
    await ensureTableExists();
  } catch (err) {
    console.error('[drawings] Failed to ensure table:', err);
    return res.status(500).json({ error: '테이블 생성 실패', details: err.message });
  }

  const query = `SELECT * FROM drawings WHERE project_id = ? AND type = ?`;

  db.get(query, [projectId, decodedType], (err, drawing) => {
    if (err) {
      console.error('[drawings] Failed to get drawing:', err);
      return res.status(500).json({ error: '도면 조회 실패', details: err.message });
    }

    if (!drawing) {
      return res.status(404).json({ error: '도면을 찾을 수 없습니다' });
    }

    try {
      const parsedDrawing = {
        id: drawing.id,
        projectId: drawing.project_id,
        type: drawing.type,
        imageUrl: drawing.image_url,
        markers: JSON.parse(drawing.markers || '[]'),
        rooms: JSON.parse(drawing.rooms || '[]'),
        naverTypeSqm: drawing.naver_type_sqm,
        naverTypePyeong: drawing.naver_type_pyeong,
        naverArea: drawing.naver_area,
        createdAt: drawing.created_at,
        updatedAt: drawing.updated_at
      };

      res.json(parsedDrawing);
    } catch (parseErr) {
      console.error('[drawings] JSON parse error:', parseErr);
      return res.status(500).json({ error: 'JSON 파싱 실패', details: parseErr.message });
    }
  });
});

// 프로젝트별 모든 도면 조회
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;

  console.log(`[drawings] GET /project request - projectId: ${projectId}`);

  try {
    await ensureTableExists();
  } catch (err) {
    console.error('[drawings] Failed to ensure table:', err);
    return res.status(500).json({ error: '테이블 생성 실패', details: err.message });
  }

  const query = `SELECT * FROM drawings WHERE project_id = ? ORDER BY type ASC`;

  db.all(query, [projectId], (err, drawings) => {
    if (err) {
      console.error('[drawings] Failed to get project drawings:', err);
      return res.status(500).json({ error: '도면 목록 조회 실패', details: err.message });
    }

    try {
      const parsedDrawings = (drawings || []).map(drawing => ({
        id: drawing.id,
        projectId: drawing.project_id,
        type: drawing.type,
        imageUrl: drawing.image_url,
        markers: JSON.parse(drawing.markers || '[]'),
        rooms: JSON.parse(drawing.rooms || '[]'),
        naverTypeSqm: drawing.naver_type_sqm,
        naverTypePyeong: drawing.naver_type_pyeong,
        naverArea: drawing.naver_area,
        createdAt: drawing.created_at,
        updatedAt: drawing.updated_at
      }));

      res.json(parsedDrawings);
    } catch (parseErr) {
      console.error('[drawings] JSON parse error:', parseErr);
      return res.status(500).json({ error: 'JSON 파싱 실패', details: parseErr.message });
    }
  });
});

// 도면 저장/업데이트 (이미지 URL 방식)
router.post('/', authenticateToken, async (req, res) => {
  const { projectId, type, imageUrl, markers, rooms, naverTypeSqm, naverTypePyeong, naverArea } = req.body;

  console.log(`[drawings] POST request - projectId: ${projectId}, type: ${type}, imageUrl: ${imageUrl ? 'provided' : 'none'}`);

  if (!projectId || !type) {
    return res.status(400).json({ error: 'projectId와 type은 필수입니다' });
  }

  try {
    await ensureTableExists();
  } catch (err) {
    console.error('[drawings] Failed to ensure table:', err);
    return res.status(500).json({ error: '테이블 생성 실패', details: err.message });
  }

  const now = new Date().toISOString();
  const checkQuery = `SELECT id, image_url FROM drawings WHERE project_id = ? AND type = ?`;

  db.get(checkQuery, [projectId, type], (err, existing) => {
    if (err) {
      console.error('[drawings] Failed to check existing:', err);
      return res.status(500).json({ error: '도면 확인 실패', details: err.message });
    }

    if (existing) {
      // 업데이트
      const updateQuery = `
        UPDATE drawings
        SET image_url = ?, markers = ?, rooms = ?, naver_type_sqm = ?, naver_type_pyeong = ?, naver_area = ?, updated_at = ?
        WHERE id = ?
      `;

      db.run(
        updateQuery,
        [imageUrl || existing.image_url, JSON.stringify(markers || []), JSON.stringify(rooms || []), naverTypeSqm, naverTypePyeong, naverArea, now, existing.id],
        function(updateErr) {
          if (updateErr) {
            console.error('[drawings] Failed to update:', updateErr);
            return res.status(500).json({ error: '도면 업데이트 실패', details: updateErr.message });
          }

          console.log(`[drawings] Updated drawing: ${existing.id}`);
          res.json({
            id: existing.id,
            projectId,
            type,
            imageUrl: imageUrl || existing.image_url,
            markers: markers || [],
            rooms: rooms || [],
            naverTypeSqm,
            naverTypePyeong,
            naverArea,
            updatedAt: now
          });
        }
      );
    } else {
      // 신규 생성
      const id = generateId();
      const insertQuery = `
        INSERT INTO drawings (id, project_id, type, image_url, markers, rooms, naver_type_sqm, naver_type_pyeong, naver_area, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(
        insertQuery,
        [id, projectId, type, imageUrl, JSON.stringify(markers || []), JSON.stringify(rooms || []), naverTypeSqm, naverTypePyeong, naverArea, now, now],
        function(insertErr) {
          if (insertErr) {
            console.error('[drawings] Failed to create:', insertErr);
            return res.status(500).json({ error: '도면 생성 실패', details: insertErr.message });
          }

          console.log(`[drawings] Created drawing: ${id}`);
          res.status(201).json({
            id,
            projectId,
            type,
            imageUrl,
            markers: markers || [],
            rooms: rooms || [],
            naverTypeSqm,
            naverTypePyeong,
            naverArea,
            createdAt: now,
            updatedAt: now
          });
        }
      );
    }
  });
});

// 도면 삭제
router.delete('/:projectId/:type', authenticateToken, async (req, res) => {
  const { projectId, type } = req.params;
  const decodedType = decodeURIComponent(type);

  console.log(`[drawings] DELETE request - projectId: ${projectId}, type: ${decodedType}`);

  // 먼저 이미지 파일 경로 조회
  db.get(`SELECT image_url FROM drawings WHERE project_id = ? AND type = ?`, [projectId, decodedType], (err, drawing) => {
    if (err) {
      console.error('[drawings] Failed to get drawing for delete:', err);
    }

    // 이미지 파일 삭제 (있으면)
    if (drawing && drawing.image_url && drawing.image_url.startsWith('/uploads/drawings/')) {
      const filePath = path.join(__dirname, '../..', drawing.image_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[drawings] Deleted image file: ${filePath}`);
      }
    }

    // DB에서 삭제
    const query = `DELETE FROM drawings WHERE project_id = ? AND type = ?`;

    db.run(query, [projectId, decodedType], function(deleteErr) {
      if (deleteErr) {
        console.error('[drawings] Failed to delete:', deleteErr);
        return res.status(500).json({ error: '도면 삭제 실패', details: deleteErr.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '도면을 찾을 수 없습니다' });
      }

      console.log(`[drawings] Deleted drawing: projectId=${projectId}, type=${decodedType}`);
      res.json({ message: '도면이 삭제되었습니다' });
    });
  });
});

// Multer 에러 핸들링
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: '파일 크기가 20MB를 초과합니다' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;
