const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// 모든 공간 조회
router.get('/spaces', authenticateToken, (req, res) => {
  const { project_id } = req.query;

  let query = 'SELECT * FROM finish_check_spaces';
  let params = [];

  if (project_id) {
    query += ' WHERE project_id = ? OR project_id IS NULL';
    params.push(project_id);
  }

  query += ' ORDER BY display_order ASC, created_at ASC';

  db.all(query, params, (err, spaces) => {
    if (err) {
      console.error('공간 목록 조회 실패:', err);
      return res.status(500).json({ error: '공간 목록 조회에 실패했습니다.' });
    }

    // 각 공간의 항목들도 함께 조회
    const spaceIds = spaces.map(s => s.id);
    if (spaceIds.length === 0) {
      return res.json(spaces.map(s => ({ ...s, items: [] })));
    }

    const itemsQuery = `
      SELECT * FROM finish_check_items
      WHERE space_id IN (${spaceIds.map(() => '?').join(',')})
      ORDER BY display_order ASC, created_at ASC
    `;

    db.all(itemsQuery, spaceIds, (err, items) => {
      if (err) {
        console.error('항목 조회 실패:', err);
        return res.status(500).json({ error: '항목 조회에 실패했습니다.' });
      }

      // 각 항목의 이미지도 조회
      const itemIds = items.map(item => item.id);
      if (itemIds.length === 0) {
        const spacesWithItems = spaces.map(space => ({
          ...space,
          items: []
        }));
        return res.json(spacesWithItems);
      }

      const imagesQuery = `
        SELECT * FROM finish_check_item_images
        WHERE item_id IN (${itemIds.map(() => '?').join(',')})
        ORDER BY created_at ASC
      `;

      db.all(imagesQuery, itemIds, (err, images) => {
        if (err) {
          console.error('이미지 조회 실패:', err);
          return res.status(500).json({ error: '이미지 조회에 실패했습니다.' });
        }

        // 항목에 이미지 추가
        const itemsWithImages = items.map(item => ({
          ...item,
          images: images.filter(img => img.item_id === item.id)
        }));

        const spacesWithItems = spaces.map(space => ({
          ...space,
          items: itemsWithImages.filter(item => item.space_id === space.id)
        }));

        res.json(spacesWithItems);
      });
    });
  });
});

// 공간 생성
router.post('/spaces', authenticateToken, (req, res) => {
  const { name, project_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: '공간 이름을 입력해주세요.' });
  }

  // 현재 최대 display_order 조회
  db.get('SELECT MAX(display_order) as max_order FROM finish_check_spaces', (err, row) => {
    if (err) {
      console.error('display_order 조회 실패:', err);
      return res.status(500).json({ error: '공간 생성에 실패했습니다.' });
    }

    const display_order = (row.max_order || 0) + 1;

    db.run(
      'INSERT INTO finish_check_spaces (name, project_id, display_order) VALUES (?, ?, ?)',
      [name, project_id || null, display_order],
      function(err) {
        if (err) {
          console.error('공간 생성 실패:', err);
          return res.status(500).json({ error: '공간 생성에 실패했습니다.' });
        }

        res.json({
          id: this.lastID,
          name,
          project_id,
          display_order,
          items: []
        });
      }
    );
  });
});

// 공간 수정
router.put('/spaces/:id', authenticateToken, (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: '공간 이름을 입력해주세요.' });
  }

  db.run(
    'UPDATE finish_check_spaces SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, req.params.id],
    function(err) {
      if (err) {
        console.error('공간 수정 실패:', err);
        return res.status(500).json({ error: '공간 수정에 실패했습니다.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '공간을 찾을 수 없습니다.' });
      }

      res.json({ message: '공간이 수정되었습니다.' });
    }
  );
});

// 공간 삭제
router.delete('/spaces/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM finish_check_spaces WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('공간 삭제 실패:', err);
      return res.status(500).json({ error: '공간 삭제에 실패했습니다.' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: '공간을 찾을 수 없습니다.' });
    }

    res.json({ message: '공간이 삭제되었습니다.' });
  });
});

// 항목 생성
router.post('/items', authenticateToken, (req, res) => {
  const { space_id, content } = req.body;

  if (!space_id || !content) {
    return res.status(400).json({ error: '공간과 내용을 입력해주세요.' });
  }

  // 현재 공간의 최대 display_order 조회
  db.get(
    'SELECT MAX(display_order) as max_order FROM finish_check_items WHERE space_id = ?',
    [space_id],
    (err, row) => {
      if (err) {
        console.error('display_order 조회 실패:', err);
        return res.status(500).json({ error: '항목 생성에 실패했습니다.' });
      }

      const display_order = (row.max_order || 0) + 1;

      db.run(
        'INSERT INTO finish_check_items (space_id, content, display_order) VALUES (?, ?, ?)',
        [space_id, content, display_order],
        function(err) {
          if (err) {
            console.error('항목 생성 실패:', err);
            return res.status(500).json({ error: '항목 생성에 실패했습니다.' });
          }

          res.json({
            id: this.lastID,
            space_id,
            content,
            is_completed: 0,
            completed_at: null,
            display_order
          });
        }
      );
    }
  );
});

// 항목 체크 토글
router.put('/items/:id/toggle', authenticateToken, (req, res) => {
  // 현재 상태 조회
  db.get('SELECT is_completed FROM finish_check_items WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('항목 조회 실패:', err);
      return res.status(500).json({ error: '항목 조회에 실패했습니다.' });
    }

    if (!row) {
      return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    }

    const newStatus = row.is_completed ? 0 : 1;
    const completedAt = newStatus ? new Date().toISOString() : null;

    db.run(
      'UPDATE finish_check_items SET is_completed = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, completedAt, req.params.id],
      function(err) {
        if (err) {
          console.error('항목 상태 변경 실패:', err);
          return res.status(500).json({ error: '항목 상태 변경에 실패했습니다.' });
        }

        res.json({
          is_completed: newStatus,
          completed_at: completedAt
        });
      }
    );
  });
});

// 항목 수정
router.put('/items/:id', authenticateToken, (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: '내용을 입력해주세요.' });
  }

  db.run(
    'UPDATE finish_check_items SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [content, req.params.id],
    function(err) {
      if (err) {
        console.error('항목 수정 실패:', err);
        return res.status(500).json({ error: '항목 수정에 실패했습니다.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
      }

      res.json({ message: '항목이 수정되었습니다.' });
    }
  );
});

// 항목 삭제
router.delete('/items/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM finish_check_items WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('항목 삭제 실패:', err);
      return res.status(500).json({ error: '항목 삭제에 실패했습니다.' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    }

    res.json({ message: '항목이 삭제되었습니다.' });
  });
});

// 항목의 이미지 업로드
router.post('/items/:id/images', authenticateToken, (req, res) => {
  const { image_data, filename } = req.body;
  const itemId = req.params.id;

  if (!image_data) {
    return res.status(400).json({ error: '이미지 데이터를 전송해주세요.' });
  }

  // 이미지 크기 체크 (base64 디코딩 후 약 5MB 이하)
  const imageSizeInBytes = (image_data.length * 3) / 4;
  const maxSizeInBytes = 5 * 1024 * 1024; // 5MB

  if (imageSizeInBytes > maxSizeInBytes) {
    return res.status(400).json({ error: '이미지 크기는 5MB 이하여야 합니다.' });
  }

  db.run(
    'INSERT INTO finish_check_item_images (item_id, image_data, filename) VALUES (?, ?, ?)',
    [itemId, image_data, filename || null],
    function(err) {
      if (err) {
        console.error('이미지 업로드 실패:', err);
        return res.status(500).json({ error: '이미지 업로드에 실패했습니다.' });
      }

      res.json({
        id: this.lastID,
        item_id: itemId,
        image_data,
        filename,
        created_at: new Date().toISOString()
      });
    }
  );
});

// 항목의 이미지 조회
router.get('/items/:id/images', authenticateToken, (req, res) => {
  const itemId = req.params.id;

  db.all(
    'SELECT * FROM finish_check_item_images WHERE item_id = ? ORDER BY created_at ASC',
    [itemId],
    (err, images) => {
      if (err) {
        console.error('이미지 조회 실패:', err);
        return res.status(500).json({ error: '이미지 조회에 실패했습니다.' });
      }

      res.json(images);
    }
  );
});

// 이미지 삭제
router.delete('/images/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM finish_check_item_images WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('이미지 삭제 실패:', err);
      return res.status(500).json({ error: '이미지 삭제에 실패했습니다.' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    }

    res.json({ message: '이미지가 삭제되었습니다.' });
  });
});

// 마이그레이션: 모든 finish_check_spaces를 특정 프로젝트로 이동
router.post('/migrate-to-project/:projectId', authenticateToken, (req, res) => {
  const projectId = req.params.projectId;

  // 먼저 프로젝트가 존재하는지 확인
  db.get('SELECT id, name FROM projects WHERE id = ?', [projectId], (err, project) => {
    if (err) {
      console.error('프로젝트 조회 실패:', err);
      return res.status(500).json({ error: '프로젝트 조회에 실패했습니다.' });
    }

    if (!project) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    }

    // project_id가 NULL인 모든 finish_check_spaces 업데이트
    db.run(
      'UPDATE finish_check_spaces SET project_id = ? WHERE project_id IS NULL',
      [projectId],
      function(err) {
        if (err) {
          console.error('마감체크 공간 마이그레이션 실패:', err);
          return res.status(500).json({ error: '마이그레이션에 실패했습니다.' });
        }

        console.log(`✓ ${this.changes}개의 공간이 "${project.name}" 프로젝트로 이동되었습니다.`);
        res.json({
          message: `${this.changes}개의 공간이 "${project.name}" 프로젝트로 이동되었습니다.`,
          updated_count: this.changes,
          project_name: project.name,
          project_id: projectId
        });
      }
    );
  });
});

module.exports = router;
