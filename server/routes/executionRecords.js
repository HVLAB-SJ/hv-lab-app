const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// 모든 실행내역 조회
router.get('/', authenticateToken, (req, res) => {
  const query = `
    SELECT er.*, p.name as project_name
    FROM execution_records er
    LEFT JOIN projects p ON er.project_id = p.id
    ORDER BY er.date DESC, er.created_at DESC
  `;

  db.all(query, [], (err, records) => {
    if (err) {
      console.error('[GET /execution-records] Error:', err);
      return res.status(500).json({ message: '실행내역 조회 실패', error: err.message });
    }
    // images 필드 파싱 (JSON 문자열 -> 배열)
    const parsedRecords = records.map(r => ({
      ...r,
      images: r.images ? JSON.parse(r.images) : []
    }));
    res.json(parsedRecords);
  });
});

// 단일 실행내역 조회
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT er.*, p.name as project_name
    FROM execution_records er
    LEFT JOIN projects p ON er.project_id = p.id
    WHERE er.id = ?
  `;

  db.get(query, [id], (err, record) => {
    if (err) {
      console.error('[GET /execution-records/:id] Error:', err);
      return res.status(500).json({ message: '실행내역 조회 실패', error: err.message });
    }
    if (!record) {
      return res.status(404).json({ message: '실행내역을 찾을 수 없습니다' });
    }
    // images 필드 파싱
    res.json({
      ...record,
      images: record.images ? JSON.parse(record.images) : []
    });
  });
});

// 실행내역 생성
router.post('/', authenticateToken, (req, res) => {
  const {
    project_name,
    author,
    date,
    process,
    item_name,
    material_cost,
    labor_cost,
    vat_amount,
    total_amount,
    notes,
    images,
    payment_id
  } = req.body;

  console.log('[POST /execution-records] Creating:', { project_name, item_name, total_amount });

  // 프로젝트 ID 조회
  db.get('SELECT id FROM projects WHERE name = ?', [project_name], (err, project) => {
    if (err) {
      console.error('[POST /execution-records] Project lookup error:', err);
    }

    const projectId = project?.id || null;
    const now = new Date().toISOString();
    const imagesJson = images ? JSON.stringify(images) : '[]';

    const query = `
      INSERT INTO execution_records (
        project_id, project_name, author, date, process, item_name,
        material_cost, labor_cost, vat_amount, total_amount, notes, images, payment_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [
      projectId,
      project_name,
      author || null,
      date,
      process || null,
      item_name,
      material_cost || 0,
      labor_cost || 0,
      vat_amount || 0,
      total_amount || 0,
      notes || null,
      imagesJson,
      payment_id || null,
      now,
      now
    ], function(err) {
      if (err) {
        console.error('[POST /execution-records] Insert error:', err);
        return res.status(500).json({ message: '실행내역 생성 실패', error: err.message });
      }

      const newId = this.lastID;
      console.log('[POST /execution-records] Created with ID:', newId);

      // 생성된 레코드 반환
      db.get(
        `SELECT er.*, p.name as project_name
         FROM execution_records er
         LEFT JOIN projects p ON er.project_id = p.id
         WHERE er.id = ?`,
        [newId],
        (err, record) => {
          if (err) {
            return res.status(500).json({ message: '생성된 레코드 조회 실패', error: err.message });
          }
          res.status(201).json({
            ...record,
            images: record.images ? JSON.parse(record.images) : []
          });
        }
      );
    });
  });
});

// 실행내역 수정
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const {
    project_name,
    author,
    date,
    process,
    item_name,
    material_cost,
    labor_cost,
    vat_amount,
    total_amount,
    notes,
    images,
    payment_id
  } = req.body;

  console.log('[PUT /execution-records/:id] Updating:', id, 'images count:', images?.length || 0);

  // 먼저 기존 레코드 조회 (부분 업데이트 지원을 위해)
  db.get('SELECT * FROM execution_records WHERE id = ?', [id], (err, existingRecord) => {
    if (err) {
      console.error('[PUT /execution-records/:id] Lookup error:', err);
      return res.status(500).json({ message: '실행내역 조회 실패', error: err.message });
    }
    if (!existingRecord) {
      return res.status(404).json({ message: '실행내역을 찾을 수 없습니다' });
    }

    // 프로젝트 ID 조회 (project_name이 제공된 경우만)
    const lookupProject = project_name !== undefined
      ? new Promise((resolve) => {
          db.get('SELECT id FROM projects WHERE name = ?', [project_name], (err, project) => {
            resolve(project?.id || null);
          });
        })
      : Promise.resolve(existingRecord.project_id);

    lookupProject.then((projectId) => {
      const now = new Date().toISOString();

      // 부분 업데이트: undefined가 아닌 값만 업데이트
      const updatedProjectId = projectId;
      const updatedProjectName = project_name !== undefined ? project_name : existingRecord.project_name;
      const updatedAuthor = author !== undefined ? (author || null) : existingRecord.author;
      const updatedDate = date !== undefined ? date : existingRecord.date;
      const updatedProcess = process !== undefined ? (process || null) : existingRecord.process;
      const updatedItemName = item_name !== undefined ? item_name : existingRecord.item_name;
      const updatedMaterialCost = material_cost !== undefined ? (material_cost || 0) : existingRecord.material_cost;
      const updatedLaborCost = labor_cost !== undefined ? (labor_cost || 0) : existingRecord.labor_cost;
      const updatedVatAmount = vat_amount !== undefined ? (vat_amount || 0) : existingRecord.vat_amount;
      const updatedTotalAmount = total_amount !== undefined ? (total_amount || 0) : existingRecord.total_amount;
      const updatedNotes = notes !== undefined ? (notes || null) : existingRecord.notes;
      const updatedImages = images !== undefined ? JSON.stringify(images) : existingRecord.images;
      const updatedPaymentId = payment_id !== undefined ? (payment_id || null) : existingRecord.payment_id;

      const query = `
        UPDATE execution_records SET
          project_id = ?,
          project_name = ?,
          author = ?,
          date = ?,
          process = ?,
          item_name = ?,
          material_cost = ?,
          labor_cost = ?,
          vat_amount = ?,
          total_amount = ?,
          notes = ?,
          images = ?,
          payment_id = ?,
          updated_at = ?
        WHERE id = ?
      `;

      db.run(query, [
        updatedProjectId,
        updatedProjectName,
        updatedAuthor,
        updatedDate,
        updatedProcess,
        updatedItemName,
        updatedMaterialCost,
        updatedLaborCost,
        updatedVatAmount,
        updatedTotalAmount,
        updatedNotes,
        updatedImages,
        updatedPaymentId,
        now,
        id
      ], function(err) {
        if (err) {
          console.error('[PUT /execution-records/:id] Error:', err);
          return res.status(500).json({ message: '실행내역 수정 실패', error: err.message });
        }

        // 수정된 레코드 반환
        db.get(
          `SELECT er.*, p.name as project_name
           FROM execution_records er
           LEFT JOIN projects p ON er.project_id = p.id
           WHERE er.id = ?`,
          [id],
          (err, record) => {
            if (err) {
              return res.status(500).json({ message: '수정된 레코드 조회 실패', error: err.message });
            }
            console.log('[PUT /execution-records/:id] Updated successfully, images:', record.images ? JSON.parse(record.images).length : 0);
            res.json({
              ...record,
              images: record.images ? JSON.parse(record.images) : []
            });
          }
        );
      });
    });
  });
});

// 실행내역 삭제
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  console.log('[DELETE /execution-records/:id] Deleting:', id);

  db.run('DELETE FROM execution_records WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('[DELETE /execution-records/:id] Error:', err);
      return res.status(500).json({ message: '실행내역 삭제 실패', error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: '실행내역을 찾을 수 없습니다' });
    }

    res.json({ message: '삭제되었습니다', id });
  });
});

module.exports = router;
