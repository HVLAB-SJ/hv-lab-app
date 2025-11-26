const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// UUID 대체 함수
const generateId = () => {
  return crypto.randomBytes(16).toString('hex');
};

// 테이블 존재 여부 확인 및 생성 (한 번만 실행)
let tableChecked = false;
const ensureTableExists = () => {
  return new Promise((resolve, reject) => {
    if (tableChecked) {
      resolve();
      return;
    }

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
        console.error('Failed to create drawings table:', err);
        reject(err);
        return;
      }
      console.log('✅ drawings table ensured');
      tableChecked = true;
      resolve();
    });
  });
};

// 도면 조회 (projectId, type으로 조회)
router.get('/:projectId/:type', authenticateToken, async (req, res) => {
  const { projectId, type } = req.params;
  const decodedType = decodeURIComponent(type);

  console.log(`[drawings] GET request - projectId: ${projectId}, type: ${decodedType}`);

  // 테이블 존재 확인
  try {
    await ensureTableExists();
  } catch (err) {
    console.error('[drawings] Failed to ensure drawings table:', err);
    return res.status(500).json({ error: '테이블 생성 실패', details: err.message });
  }

  const query = `
    SELECT * FROM drawings
    WHERE project_id = ? AND type = ?
  `;

  db.get(query, [projectId, decodedType], (err, drawing) => {
    if (err) {
      console.error('[drawings] Failed to get drawing:', err);
      return res.status(500).json({ error: '도면 조회 실패', details: err.message, code: err.code });
    }

    if (!drawing) {
      return res.status(404).json({ error: '도면을 찾을 수 없습니다' });
    }

    // Parse JSON strings with error handling
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

  // 테이블 존재 확인
  try {
    await ensureTableExists();
  } catch (err) {
    console.error('[drawings] Failed to ensure drawings table:', err);
    return res.status(500).json({ error: '테이블 생성 실패', details: err.message });
  }

  const query = `
    SELECT * FROM drawings
    WHERE project_id = ?
    ORDER BY type ASC
  `;

  db.all(query, [projectId], (err, drawings) => {
    if (err) {
      console.error('[drawings] Failed to get project drawings:', err);
      return res.status(500).json({ error: '도면 목록 조회 실패', details: err.message, code: err.code });
    }

    try {
      const parsedDrawings = drawings.map(drawing => ({
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
      console.error('[drawings] JSON parse error in project list:', parseErr);
      return res.status(500).json({ error: 'JSON 파싱 실패', details: parseErr.message });
    }
  });
});

// 도면 생성 또는 업데이트 (upsert)
router.post('/', authenticateToken, async (req, res) => {
  const { projectId, type, imageUrl, markers, rooms, naverTypeSqm, naverTypePyeong, naverArea } = req.body;

  // 요청 데이터 로깅
  const imageSize = imageUrl ? Math.round(imageUrl.length / 1024) : 0;
  console.log(`[drawings] POST request - projectId: ${projectId}, type: ${type}, imageSize: ${imageSize}KB`);

  if (!projectId || !type) {
    return res.status(400).json({ error: 'projectId와 type은 필수입니다' });
  }

  // 이미지 크기 제한 (10MB = 약 10,000KB in base64)
  if (imageSize > 10000) {
    console.warn(`[drawings] 이미지 크기 초과: ${imageSize}KB`);
    return res.status(413).json({
      error: `이미지 크기가 너무 큽니다 (${imageSize}KB). 10MB 이하로 압축해주세요.`
    });
  }

  // 테이블 존재 확인
  try {
    await ensureTableExists();
  } catch (err) {
    console.error('[drawings] Failed to ensure drawings table:', err);
    return res.status(500).json({ error: '테이블 생성 실패', details: err.message });
  }

  const now = new Date().toISOString();

  // 기존 도면이 있는지 확인
  const checkQuery = `SELECT id FROM drawings WHERE project_id = ? AND type = ?`;

  db.get(checkQuery, [projectId, type], (err, existing) => {
    if (err) {
      console.error('Failed to check existing drawing:', err);
      return res.status(500).json({ error: '도면 확인 실패' });
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
        [imageUrl, JSON.stringify(markers || []), JSON.stringify(rooms || []), naverTypeSqm, naverTypePyeong, naverArea, now, existing.id],
        function(err) {
          if (err) {
            console.error('[drawings] Failed to update drawing:', err);
            return res.status(500).json({
              error: '도면 업데이트 실패',
              details: err.message,
              code: err.code
            });
          }

          res.json({
            id: existing.id,
            projectId,
            type,
            imageUrl,
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
        function(err) {
          if (err) {
            console.error('[drawings] Failed to create drawing:', err);
            return res.status(500).json({
              error: '도면 생성 실패',
              details: err.message,
              code: err.code
            });
          }

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
router.delete('/:projectId/:type', authenticateToken, (req, res) => {
  const { projectId, type } = req.params;
  const decodedType = decodeURIComponent(type);

  const query = `DELETE FROM drawings WHERE project_id = ? AND type = ?`;

  db.run(query, [projectId, decodedType], function(err) {
    if (err) {
      console.error('Failed to delete drawing:', err);
      return res.status(500).json({ error: '도면 삭제 실패' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: '도면을 찾을 수 없습니다' });
    }

    res.json({ message: '도면이 삭제되었습니다' });
  });
});

module.exports = router;
