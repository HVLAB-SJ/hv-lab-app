const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

// 모든 공정 목록 조회
router.get('/', (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';

  let query = 'SELECT * FROM processes';
  if (!includeInactive) {
    query += ' WHERE is_active = 1';
  }
  query += ' ORDER BY sort_order ASC, id ASC';

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('공정 목록 조회 오류:', err.message);
      return res.status(500).json({ error: '공정 목록을 불러오는데 실패했습니다.' });
    }
    res.json(rows);
  });
});

// 공정 추가
router.post('/', (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '공정명을 입력해주세요.' });
  }

  // 최대 sort_order 조회
  db.get('SELECT MAX(sort_order) as maxOrder FROM processes', [], (err, row) => {
    if (err) {
      console.error('공정 순서 조회 오류:', err.message);
      return res.status(500).json({ error: '공정 추가에 실패했습니다.' });
    }

    const newOrder = (row.maxOrder || 0) + 1;

    db.run(
      'INSERT INTO processes (name, sort_order) VALUES (?, ?)',
      [name.trim(), newOrder],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: '이미 존재하는 공정명입니다.' });
          }
          console.error('공정 추가 오류:', err.message);
          return res.status(500).json({ error: '공정 추가에 실패했습니다.' });
        }

        res.status(201).json({
          id: this.lastID,
          name: name.trim(),
          sort_order: newOrder,
          is_active: 1
        });
      }
    );
  });
});

// 공정 수정
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, is_active } = req.body;

  if (name !== undefined && (!name || !name.trim())) {
    return res.status(400).json({ error: '공정명을 입력해주세요.' });
  }

  // 동적으로 업데이트할 필드 구성
  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name.trim());
  }

  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '수정할 내용이 없습니다.' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  db.run(
    `UPDATE processes SET ${updates.join(', ')} WHERE id = ?`,
    params,
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: '이미 존재하는 공정명입니다.' });
        }
        console.error('공정 수정 오류:', err.message);
        return res.status(500).json({ error: '공정 수정에 실패했습니다.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '해당 공정을 찾을 수 없습니다.' });
      }

      res.json({ message: '공정이 수정되었습니다.' });
    }
  );
});

// 공정 삭제
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM processes WHERE id = ?', [id], function (err) {
    if (err) {
      console.error('공정 삭제 오류:', err.message);
      return res.status(500).json({ error: '공정 삭제에 실패했습니다.' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: '해당 공정을 찾을 수 없습니다.' });
    }

    res.json({ message: '공정이 삭제되었습니다.' });
  });
});

// 공정 순서 변경 (벌크 업데이트)
router.put('/reorder/bulk', (req, res) => {
  const { orders } = req.body;

  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ error: '순서 정보가 필요합니다.' });
  }

  db.serialize(() => {
    const stmt = db.prepare('UPDATE processes SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

    orders.forEach((item, index) => {
      stmt.run(index, item.id);
    });

    stmt.finalize((err) => {
      if (err) {
        console.error('공정 순서 변경 오류:', err.message);
        return res.status(500).json({ error: '순서 변경에 실패했습니다.' });
      }

      res.json({ message: '순서가 변경되었습니다.' });
    });
  });
});

module.exports = router;
