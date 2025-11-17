const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// 프로젝트별 현장일지 조회
router.get('/project/:projectName', authenticateToken, (req, res) => {
  const { projectName } = req.params;

  const query = `
    SELECT * FROM site_logs
    WHERE project = ?
    ORDER BY date DESC, created_at DESC
  `;

  db.all(query, [projectName], (err, logs) => {
    if (err) {
      console.error('Failed to get site logs:', err);
      return res.status(500).json({ error: '현장일지 조회 실패' });
    }

    // Parse JSON strings for images
    const parsedLogs = logs.map(log => ({
      ...log,
      _id: log.id,
      images: JSON.parse(log.images || '[]')
    }));

    res.json(parsedLogs);
  });
});

// 모든 현장일지 조회
router.get('/', authenticateToken, (req, res) => {
  const query = `
    SELECT * FROM site_logs
    ORDER BY date DESC, created_at DESC
  `;

  db.all(query, [], (err, logs) => {
    if (err) {
      console.error('Failed to get all site logs:', err);
      return res.status(500).json({ error: '현장일지 조회 실패' });
    }

    // Parse JSON strings for images
    const parsedLogs = logs.map(log => ({
      ...log,
      _id: log.id,
      images: JSON.parse(log.images || '[]')
    }));

    res.json(parsedLogs);
  });
});

// 현장일지 생성
router.post('/', authenticateToken, (req, res) => {
  const { project, date, images, notes, createdBy } = req.body;

  if (!project || !date || !images || images.length === 0) {
    return res.status(400).json({ error: '필수 항목을 입력해주세요' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  const query = `
    INSERT INTO site_logs (id, project, date, images, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [id, project, date, JSON.stringify(images), notes, createdBy, now],
    function(err) {
      if (err) {
        console.error('Failed to create site log:', err);
        return res.status(500).json({ error: '현장일지 생성 실패' });
      }

      res.status(201).json({
        id,
        _id: id,
        project,
        date,
        images,
        notes,
        createdBy,
        createdAt: now
      });
    }
  );
});

// 현장일지 수정
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { project, date, images, notes } = req.body;

  const query = `
    UPDATE site_logs
    SET project = ?, date = ?, images = ?, notes = ?
    WHERE id = ?
  `;

  db.run(
    query,
    [project, date, JSON.stringify(images), notes, id],
    function(err) {
      if (err) {
        console.error('Failed to update site log:', err);
        return res.status(500).json({ error: '현장일지 수정 실패' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '현장일지를 찾을 수 없습니다' });
      }

      res.json({ message: '현장일지가 수정되었습니다' });
    }
  );
});

// 현장일지 삭제
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM site_logs WHERE id = ?`;

  db.run(query, [id], function(err) {
    if (err) {
      console.error('Failed to delete site log:', err);
      return res.status(500).json({ error: '현장일지 삭제 실패' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: '현장일지를 찾을 수 없습니다' });
    }

    res.json({ message: '현장일지가 삭제되었습니다' });
  });
});

// 날짜 범위로 조회
router.get('/range', authenticateToken, (req, res) => {
  const { project, startDate, endDate } = req.query;

  let query = `
    SELECT * FROM site_logs
    WHERE 1=1
  `;
  const params = [];

  if (project) {
    query += ' AND project = ?';
    params.push(project);
  }

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY date DESC, created_at DESC';

  db.all(query, params, (err, logs) => {
    if (err) {
      console.error('Failed to get site logs by range:', err);
      return res.status(500).json({ error: '현장일지 조회 실패' });
    }

    // Parse JSON strings for images
    const parsedLogs = logs.map(log => ({
      ...log,
      _id: log.id,
      images: JSON.parse(log.images || '[]')
    }));

    res.json(parsedLogs);
  });
});

module.exports = router;