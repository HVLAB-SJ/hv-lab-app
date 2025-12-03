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

// 가견적서 계산 (저장하지 않고 미리보기만)
router.post('/calculate', authenticateToken, async (req, res) => {
  const {
    areaSize,
    grade,
    bathroomCount,
    ceilingHeight,
    includeSash,
    includeFloorHeating,
    includeAircon,
    floorMaterial,
    wallMaterial,
    ceilingMaterial,
    furnitureWork,
    kitchenCountertop,
    switchPublic,
    switchRoom,
    lightingType,
    indirectLightingPublic,
    indirectLightingRoom,
    moldingPublic,
    moldingRoom,
    bathroomCeiling,
    bathroomFaucet,
    bathroomTile,
    bathroomGrout
  } = req.body;

  try {
    const areaRange = getAreaRange(areaSize);

    // 가격 설정 조회
    const priceSettings = await new Promise((resolve, reject) => {
      db.get('SELECT settings FROM estimate_price_settings ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row ? JSON.parse(row.settings) : {});
      });
    });

    // grade가 배열인 경우 첫 번째 값 사용
    const gradeArr = JSON.parse(grade || '[]');
    const selectedGrade = gradeArr[0] || '기본';

    // 기본 공사비 계산
    let baseConstructionCost = Math.floor(BASE_CONSTRUCTION[selectedGrade] * areaSize);

    // 층고에 따른 추가 비용
    const ceilingHeightArr = JSON.parse(ceilingHeight || '[]');
    const selectedCeilingHeight = ceilingHeightArr[0] || '2400~2600';
    baseConstructionCost = Math.floor(baseConstructionCost * CEILING_HEIGHT_MULTIPLIER[selectedCeilingHeight]);

    // 화장실 개수에 따른 추가 비용
    const bathroomCountArr = JSON.parse(bathroomCount || '[]');
    const selectedBathroomCount = parseInt(bathroomCountArr[0]) || 1;
    const additionalBathroomCost = selectedBathroomCount > 1 ? (selectedBathroomCount - 1) * 3000000 : 0;
    baseConstructionCost += additionalBathroomCost;

    // 항목별 비용 계산 함수
    const calculateItemCost = (category, items, multiplier = areaSize) => {
      if (!items || !priceSettings[category]) return 0;

      const itemArr = JSON.parse(items || '[]');
      let totalCost = 0;

      itemArr.forEach(item => {
        if (priceSettings[category][item]) {
          const { min, max } = priceSettings[category][item];
          const minPrice = parseFloat(min) || 0;
          const maxPrice = parseFloat(max) || 0;
          const avgPrice = (minPrice + maxPrice) / 2;
          totalCost += avgPrice * multiplier;
        }
      });

      return Math.floor(totalCost);
    };

    // 화장실 항목별 비용 계산
    const calculateBathroomItemCost = (subCategory, items) => {
      if (!items || !priceSettings.bathroom || !priceSettings.bathroom[subCategory]) return 0;

      const itemArr = JSON.parse(items || '[]');
      let totalCost = 0;

      itemArr.forEach(item => {
        if (priceSettings.bathroom[subCategory][item]) {
          const { min, max } = priceSettings.bathroom[subCategory][item];
          const minPrice = parseFloat(min) || 0;
          const maxPrice = parseFloat(max) || 0;
          const avgPrice = (minPrice + maxPrice) / 2;
          totalCost += avgPrice * selectedBathroomCount; // 화장실 개수만큼 곱하기
        }
      });

      return Math.floor(totalCost);
    };

    // 설정 기반 항목별 비용 계산
    const floorCost = calculateItemCost('floor', floorMaterial);
    const wallCost = calculateItemCost('wall', wallMaterial);
    const ceilingCost = calculateItemCost('wall', ceilingMaterial); // 천장재도 wall 카테고리 사용
    const furnitureCost = calculateItemCost('furniture', furnitureWork);
    const countertopCost = calculateItemCost('countertop', kitchenCountertop, 1); // 주방 상판은 평수 곱하지 않음
    const switchPublicCost = calculateItemCost('switch', switchPublic); // 평당 계산
    const switchRoomCost = calculateItemCost('switch', switchRoom); // 평당 계산
    const lightingCost = calculateItemCost('lighting', lightingType); // 평당 계산
    const indirectPublicCost = calculateItemCost('indirectLighting', indirectLightingPublic); // 평당 계산
    const indirectRoomCost = calculateItemCost('indirectLighting', indirectLightingRoom); // 평당 계산
    const moldingPublicCost = calculateItemCost('molding', moldingPublic);
    const moldingRoomCost = calculateItemCost('molding', moldingRoom);

    // 화장실 항목별 비용
    const bathroomCeilingCost = calculateBathroomItemCost('ceiling', bathroomCeiling);
    const bathroomFaucetCost = calculateBathroomItemCost('faucet', bathroomFaucet);
    const bathroomTileCost = calculateBathroomItemCost('tile', bathroomTile);
    const bathroomGroutCost = calculateBathroomItemCost('grout', bathroomGrout);

    // 총 설정 기반 비용
    const settingsBasedCost = floorCost + wallCost + ceilingCost + furnitureCost +
                              countertopCost + switchPublicCost + switchRoomCost +
                              lightingCost + indirectPublicCost + indirectRoomCost +
                              moldingPublicCost + moldingRoomCost +
                              bathroomCeilingCost + bathroomFaucetCost +
                              bathroomTileCost + bathroomGroutCost;

    // 스펙북에서 해당 등급 아이템들의 가격 조회 (카테고리별 최소/최대 가격)
    const fixtureQuery = `
      SELECT category,
             COUNT(*) as count,
             MIN(CAST(REPLACE(price, ',', '') AS INTEGER)) as min_price,
             MAX(CAST(REPLACE(price, ',', '') AS INTEGER)) as max_price
      FROM specbook_items
      WHERE is_library = 1
      AND price IS NOT NULL
      AND price != ''
      AND (grade LIKE ? OR grade LIKE ? OR grade LIKE ? OR grade = ?)
      GROUP BY category
    `;

    const fixtures = await new Promise((resolve, reject) => {
      db.all(fixtureQuery, [`%${selectedGrade}%`, `%${selectedGrade},%`, `%,${selectedGrade}%`, selectedGrade], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // 집기류 비용 계산 (최소/최대 범위)
    let fixtureCostMin = 0;
    let fixtureCostMax = 0;
    const fixtureItemsWithQuantity = fixtures.map(fixture => {
      let quantity = 1;
      // 화장실 관련 집기: 화장실 개수만큼 곱하기
      if (['변기', '세면대', '수전', '샤워수전', '욕조', '비데', '수건걸이', '휴지걸이'].includes(fixture.category)) {
        quantity = selectedBathroomCount;
      } else if (['타일', '마루', '벽지'].includes(fixture.category)) {
        quantity = Math.ceil(areaSize / 10);
      }

      const minTotal = (fixture.min_price || 0) * quantity;
      const maxTotal = (fixture.max_price || 0) * quantity;

      fixtureCostMin += minTotal;
      fixtureCostMax += maxTotal;

      return {
        category: fixture.category,
        count: fixture.count,
        quantity: quantity,
        minPrice: fixture.min_price || 0,
        maxPrice: fixture.max_price || 0,
        minTotal: minTotal,
        maxTotal: maxTotal
      };
    });

    // 기존 호환을 위해 평균값도 계산
    const fixtureCost = Math.floor((fixtureCostMin + fixtureCostMax) / 2);

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

    // 총 비용 계산 (집기류 최소/최대 범위 적용)
    const baseCost = baseConstructionCost + settingsBasedCost + sashCost + heatingCost + airconCost;
    const totalMinCost = Math.floor(baseCost + fixtureCostMin);
    const totalMaxCost = Math.floor(baseCost + fixtureCostMax);

    // 상세 내역 JSON 생성
    const detailBreakdown = {
      baseConstruction: baseConstructionCost,
      fixtures: fixtureCost,
      fixturesMin: fixtureCostMin,
      fixturesMax: fixtureCostMax,
      additionalBathrooms: additionalBathroomCost,
      settingsBasedCost: settingsBasedCost,
      itemDetails: {
        floor: floorCost,
        wall: wallCost,
        ceiling: ceilingCost,
        furniture: furnitureCost,
        countertop: countertopCost,
        switchPublic: switchPublicCost,
        switchRoom: switchRoomCost,
        lighting: lightingCost,
        indirectPublic: indirectPublicCost,
        indirectRoom: indirectRoomCost,
        moldingPublic: moldingPublicCost,
        moldingRoom: moldingRoomCost,
        bathroomCeiling: bathroomCeilingCost,
        bathroomFaucet: bathroomFaucetCost,
        bathroomTile: bathroomTileCost,
        bathroomGrout: bathroomGroutCost
      },
      sash: sashCost,
      floorHeating: heatingCost,
      aircon: airconCost,
      fixtureItems: fixtureItemsWithQuantity
    };

    // 결과 반환 (DB 저장 없음)
    res.json({
      baseConstructionCost,
      fixtureCost,
      fixtureCostMin,
      fixtureCostMax,
      settingsBasedCost,
      sashCost,
      heatingCost,
      airconCost,
      totalMinCost,
      totalMaxCost,
      detailBreakdown
    });

  } catch (error) {
    console.error('가견적서 계산 실패:', error);
    res.status(500).json({ error: '가견적서 계산에 실패했습니다.' });
  }
});

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
    airconType,
    floorMaterial,
    wallMaterial,
    ceilingMaterial,
    furnitureWork,
    kitchenCountertop,
    switchPublic,
    switchRoom,
    lightingType,
    indirectLightingPublic,
    indirectLightingRoom,
    bathroomCeiling,
    bathroomFaucet,
    bathroomTile,
    moldingPublic,
    moldingRoom
  } = req.body;

  try {
    const areaRange = getAreaRange(areaSize);

    // 기본 공사비 계산
    let baseConstructionCost = Math.floor(BASE_CONSTRUCTION[grade] * areaSize);

    // 층고에 따른 추가 비용 (배열에서 첫 번째 값 사용)
    const ceilingHeightArr = JSON.parse(ceilingHeight || '[]');
    const selectedCeilingHeight = ceilingHeightArr[0] || '2400~2600';
    baseConstructionCost = Math.floor(baseConstructionCost * CEILING_HEIGHT_MULTIPLIER[selectedCeilingHeight]);

    // 화장실 개수에 따른 추가 비용 (배열에서 첫 번째 값 사용)
    const bathroomCountArr = JSON.parse(bathroomCount || '[]');
    const selectedBathroomCount = parseInt(bathroomCountArr[0]) || 1;
    const additionalBathroomCost = selectedBathroomCount > 1 ? (selectedBathroomCount - 1) * 3000000 : 0;
    baseConstructionCost += additionalBathroomCost;

    // 스펙북에서 해당 등급 아이템들의 가격 조회 (카테고리별 최소/최대 가격)
    const fixtureQuery = `
      SELECT category,
             COUNT(*) as count,
             MIN(CAST(REPLACE(price, ',', '') AS INTEGER)) as min_price,
             MAX(CAST(REPLACE(price, ',', '') AS INTEGER)) as max_price
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

    // 집기류 비용 계산 (최소/최대 범위)
    let fixtureCostMin = 0;
    let fixtureCostMax = 0;
    const fixtureItemsWithQuantity = fixtures.map(fixture => {
      let quantity = 1;
      // 화장실 관련 집기: 화장실 개수만큼 곱하기
      if (['변기', '세면대', '수전', '샤워수전', '욕조', '비데', '수건걸이', '휴지걸이'].includes(fixture.category)) {
        quantity = selectedBathroomCount;
      } else if (['타일', '마루', '벽지'].includes(fixture.category)) {
        quantity = Math.ceil(areaSize / 10); // 10평당 1단위
      }

      const minTotal = (fixture.min_price || 0) * quantity;
      const maxTotal = (fixture.max_price || 0) * quantity;

      fixtureCostMin += minTotal;
      fixtureCostMax += maxTotal;

      return {
        category: fixture.category,
        count: fixture.count,
        quantity: quantity,
        minPrice: fixture.min_price || 0,
        maxPrice: fixture.max_price || 0,
        minTotal: minTotal,
        maxTotal: maxTotal
      };
    });

    // 기존 호환을 위해 평균값도 계산
    const fixtureCost = Math.floor((fixtureCostMin + fixtureCostMax) / 2);

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

    // 총 비용 계산 (집기류 최소/최대 범위 적용)
    const baseCost = baseConstructionCost + sashCost + heatingCost + airconCost;
    const totalMinCost = Math.floor(baseCost + fixtureCostMin);
    const totalMaxCost = Math.floor(baseCost + fixtureCostMax);

    // 상세 내역 JSON 생성
    const detailBreakdown = JSON.stringify({
      baseConstruction: baseConstructionCost,
      fixtures: fixtureCost,
      fixturesMin: fixtureCostMin,
      fixturesMax: fixtureCostMax,
      additionalBathrooms: additionalBathroomCost,
      sash: sashCost,
      floorHeating: heatingCost,
      aircon: airconCost,
      fixtureItems: fixtureItemsWithQuantity
    });

    // DB에 저장
    const query = `
      INSERT INTO estimate_previews (
        project_name, client_name, area_size, grade, finish_type,
        bathroom_count, ceiling_height, include_sash, include_floor_heating, include_aircon,
        base_construction_cost, fixture_cost, sash_cost, heating_cost, aircon_cost,
        total_min_cost, total_max_cost, detail_breakdown, created_by,
        aircon_type, floor_material, wall_material, ceiling_material, furniture_work, kitchen_countertop,
        switch_public, switch_room, lighting_type, indirect_lighting_public, indirect_lighting_room,
        bathroom_ceiling, bathroom_faucet, bathroom_tile, molding_public, molding_room
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [
      projectName, clientName, areaSize, grade, finishType,
      bathroomCount, ceilingHeight, includeSash ? 1 : 0, includeFloorHeating ? 1 : 0, includeAircon ? 1 : 0,
      baseConstructionCost, fixtureCost, sashCost, heatingCost, airconCost,
      totalMinCost, totalMaxCost, detailBreakdown, req.user.userId,
      airconType, floorMaterial, wallMaterial, ceilingMaterial, furnitureWork, kitchenCountertop,
      switchPublic, switchRoom, lightingType, indirectLightingPublic, indirectLightingRoom,
      bathroomCeiling, bathroomFaucet, bathroomTile, moldingPublic, moldingRoom
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
        switchPublic,
        switchRoom,
        lightingType,
        indirectLightingPublic,
        indirectLightingRoom,
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

// 가격 설정 조회
router.get('/settings/prices', authenticateToken, (req, res) => {
  const query = 'SELECT settings FROM estimate_price_settings ORDER BY id DESC LIMIT 1';

  db.get(query, (err, row) => {
    if (err) {
      console.error('가격 설정 조회 실패:', err);
      return res.status(500).json({ error: '가격 설정 조회에 실패했습니다.' });
    }

    if (!row) {
      // 설정이 없으면 빈 객체 반환
      return res.json({ settings: {} });
    }

    res.json({ settings: JSON.parse(row.settings) });
  });
});

// 가격 설정 저장
router.post('/settings/prices', authenticateToken, (req, res) => {
  const { settings } = req.body;

  if (!settings) {
    return res.status(400).json({ error: '설정 데이터가 필요합니다.' });
  }

  const settingsJson = JSON.stringify(settings);

  // 기존 설정이 있는지 확인
  db.get('SELECT id FROM estimate_price_settings LIMIT 1', (err, row) => {
    if (err) {
      console.error('설정 확인 실패:', err);
      return res.status(500).json({ error: '설정 저장에 실패했습니다.' });
    }

    if (row) {
      // 업데이트
      db.run(
        'UPDATE estimate_price_settings SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [settingsJson, row.id],
        (err) => {
          if (err) {
            console.error('설정 업데이트 실패:', err);
            return res.status(500).json({ error: '설정 저장에 실패했습니다.' });
          }
          res.json({ message: '설정이 저장되었습니다.' });
        }
      );
    } else {
      // 새로 생성
      db.run(
        'INSERT INTO estimate_price_settings (settings) VALUES (?)',
        [settingsJson],
        (err) => {
          if (err) {
            console.error('설정 생성 실패:', err);
            return res.status(500).json({ error: '설정 저장에 실패했습니다.' });
          }
          res.json({ message: '설정이 저장되었습니다.' });
        }
      );
    }
  });
});

module.exports = router;