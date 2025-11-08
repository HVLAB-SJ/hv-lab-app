const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');

// 평형대별 추가 공사 비용 상수
const ADDITIONAL_COSTS = {
  sash: {
    '10-20': { min: 4000000, max: 6000000 },
    '20-30': { min: 6000000, max: 8000000 },
    '30-40': { min: 8000000, max: 10000000 },
    '40+': { min: 10000000, max: 12000000 }
  },
  floorHeating: {
    perPyeong: 150000  // 평당 15만원
  },
  aircon: {
    '10-20': { min: 3000000, max: 4000000 },
    '20-30': { min: 4000000, max: 5000000 },
    '30-40': { min: 5000000, max: 7000000 },
    '40+': { min: 7000000, max: 9000000 }
  }
};

// 기본 공사비 (평당)
const BASE_CONSTRUCTION = {
  '알뜰': 1500000,
  '기본': 2000000,
  '고급': 2500000,
  '하이엔드': 3000000
};

// 층고별 추가 비용 (%)
const CEILING_HEIGHT_MULTIPLIER = {
  '2400이하': 1.0,
  '2400~2600': 1.1,
  '2600이상': 1.2
};

// 평형대 판별 함수
function getAreaRange(area) {
  if (area <= 20) return '10-20';
  if (area <= 30) return '20-30';
  if (area <= 40) return '30-40';
  return '40+';
}

// 가견적서 생성
router.post('/create', authenticateToken, async (req, res) => {
  const {
    projectName,
    clientName,
    areaSize,
    grade,
    finishType,
    bathroomCount,
    ceilingHeight,
    includeSash,
    includeFloorHeating,
    includeAircon,
    floorMaterial,
    wallMaterial,
    bathroomWorkType,
    ceilingWorkType,
    switchType,
    switchPremium,
    lightingType,
    bathroomCeiling,
    bathroomFaucet,
    bathroomTile,
    moldingType
  } = req.body;

  try {
    const areaRange = getAreaRange(areaSize);

    // 기본 공사비 계산
    let baseConstructionCost = Math.floor(BASE_CONSTRUCTION[grade] * areaSize);

    // 층고에 따른 추가 비용
    baseConstructionCost = Math.floor(baseConstructionCost * CEILING_HEIGHT_MULTIPLIER[ceilingHeight || '2400~2600']);

    // 화장실 개수에 따른 추가 비용 (추가 화장실당 300만원)
    const additionalBathroomCost = bathroomCount > 1 ? (bathroomCount - 1) * 3000000 : 0;
    baseConstructionCost += additionalBathroomCost;

    // 스펙북에서 해당 등급 아이템들의 가격 조회
    const fixtureQuery = `
      SELECT category, COUNT(*) as count, AVG(CAST(REPLACE(price, ',', '') AS INTEGER)) as avg_price
      FROM specbook_items
      WHERE is_library = 1
      AND price IS NOT NULL
      AND price != ''
      AND (grade LIKE ? OR grade LIKE ? OR grade LIKE ? OR grade = ?)
      GROUP BY category
    `;

    const fixtures = await new Promise((resolve, reject) => {
      db.all(fixtureQuery, [`%${grade}%`, `%${grade},%`, `%,${grade}%`, grade], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // 집기류 비용 계산 (카테고리별 평균 가격 * 수량 추정)
    let fixtureCost = 0;
    fixtures.forEach(fixture => {
      // 평수에 따른 수량 계산 (카테고리별로 다르게 적용)
      let quantity = 1;
      if (['변기', '세면대', '수전', '샤워수전'].includes(fixture.category)) {
        quantity = bathroomCount;
      } else if (['타일', '마루', '벽지'].includes(fixture.category)) {
        quantity = Math.ceil(areaSize / 10); // 10평당 1단위
      }

      fixtureCost += fixture.avg_price * quantity;
    });

    // 추가 공사 비용 계산
    let sashCost = 0;
    if (includeSash) {
      const cost = ADDITIONAL_COSTS.sash[areaRange];
      sashCost = Math.floor((cost.min + cost.max) / 2);
    }

    let heatingCost = 0;
    if (includeFloorHeating) {
      heatingCost = Math.floor(ADDITIONAL_COSTS.floorHeating.perPyeong * areaSize);
    }

    let airconCost = 0;
    if (includeAircon) {
      const cost = ADDITIONAL_COSTS.aircon[areaRange];
      airconCost = Math.floor((cost.min + cost.max) / 2);
    }

    // 총 비용 계산 (±15% 범위)
    const totalCost = baseConstructionCost + fixtureCost + sashCost + heatingCost + airconCost;
    const totalMinCost = Math.floor(totalCost * 0.85);
    const totalMaxCost = Math.floor(totalCost * 1.15);

    // 상세 내역 JSON 생성
    const detailBreakdown = JSON.stringify({
      baseConstruction: baseConstructionCost,
      fixtures: fixtureCost,
      additionalBathrooms: additionalBathroomCost,
      sash: sashCost,
      floorHeating: heatingCost,
      aircon: airconCost,
      fixtureDetails: fixtures
    });

    // DB에 저장
    const query = `
      INSERT INTO estimate_previews (
        project_name, client_name, area_size, grade, finish_type,
        bathroom_count, ceiling_height, include_sash, include_floor_heating, include_aircon,
        base_construction_cost, fixture_cost, sash_cost, heating_cost, aircon_cost,
        total_min_cost, total_max_cost, detail_breakdown, created_by,
        floor_material, wall_material, bathroom_work_type, ceiling_work_type,
        switch_type, switch_premium, lighting_type, bathroom_ceiling,
        bathroom_faucet, bathroom_tile, molding_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [
      projectName, clientName, areaSize, grade, finishType,
      bathroomCount, ceilingHeight, includeSash ? 1 : 0, includeFloorHeating ? 1 : 0, includeAircon ? 1 : 0,
      baseConstructionCost, fixtureCost, sashCost, heatingCost, airconCost,
      totalMinCost, totalMaxCost, detailBreakdown, req.user.userId,
      floorMaterial, wallMaterial, bathroomWorkType, ceilingWorkType,
      switchType, switchPremium, lightingType, bathroomCeiling,
      bathroomFaucet, bathroomTile, moldingType
    ], function(err) {
      if (err) {
        console.error('가견적서 저장 실패:', err);
        return res.status(500).json({ error: '가견적서 저장에 실패했습니다.' });
      }

      res.json({
        id: this.lastID,
        projectName,
        clientName,
        areaSize,
        grade,
        baseConstructionCost,
        fixtureCost,
        sashCost,
        heatingCost,
        airconCost,
        totalMinCost,
        totalMaxCost,
        detailBreakdown: JSON.parse(detailBreakdown),
        floorMaterial,
        wallMaterial,
        bathroomWorkType,
        ceilingWorkType,
        switchType,
        switchPremium,
        lightingType,
        bathroomCeiling,
        bathroomFaucet,
        bathroomTile,
        moldingType
      });
    });

  } catch (error) {
    console.error('가견적서 생성 실패:', error);
    res.status(500).json({ error: '가견적서 생성에 실패했습니다.' });
  }
});

// 가견적서 목록 조회
router.get('/list', authenticateToken, (req, res) => {
  const query = `
    SELECT ep.*, u.username as created_by_name
    FROM estimate_previews ep
    LEFT JOIN users u ON ep.created_by = u.id
    ORDER BY ep.created_at DESC
    LIMIT 100
  `;

  db.all(query, (err, rows) => {
    if (err) {
      console.error('가견적서 목록 조회 실패:', err);
      return res.status(500).json({ error: '가견적서 목록 조회에 실패했습니다.' });
    }

    // detail_breakdown을 JSON으로 파싱
    const estimates = rows.map(row => ({
      ...row,
      detail_breakdown: row.detail_breakdown ? JSON.parse(row.detail_breakdown) : null
    }));

    res.json(estimates);
  });
});

// 가견적서 상세 조회
router.get('/:id', authenticateToken, (req, res) => {
  const query = `
    SELECT ep.*, u.username as created_by_name
    FROM estimate_previews ep
    LEFT JOIN users u ON ep.created_by = u.id
    WHERE ep.id = ?
  `;

  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      console.error('가견적서 조회 실패:', err);
      return res.status(500).json({ error: '가견적서 조회에 실패했습니다.' });
    }

    if (!row) {
      return res.status(404).json({ error: '가견적서를 찾을 수 없습니다.' });
    }

    // detail_breakdown을 JSON으로 파싱
    if (row.detail_breakdown) {
      row.detail_breakdown = JSON.parse(row.detail_breakdown);
    }

    res.json(row);
  });
});

// 가견적서 삭제
router.delete('/:id', authenticateToken, isManager, (req, res) => {
  db.run('DELETE FROM estimate_previews WHERE id = ?', [req.params.id], (err) => {
    if (err) {
      console.error('가견적서 삭제 실패:', err);
      return res.status(500).json({ error: '가견적서 삭제에 실패했습니다.' });
    }

    res.json({ message: '가견적서가 삭제되었습니다.' });
  });
});

// 추가 공사 비용 정보 조회
router.get('/costs/additional', authenticateToken, (req, res) => {
  res.json({
    sash: ADDITIONAL_COSTS.sash,
    floorHeating: ADDITIONAL_COSTS.floorHeating,
    aircon: ADDITIONAL_COSTS.aircon,
    baseConstruction: BASE_CONSTRUCTION,
    ceilingHeightMultiplier: CEILING_HEIGHT_MULTIPLIER
  });
});

module.exports = router;