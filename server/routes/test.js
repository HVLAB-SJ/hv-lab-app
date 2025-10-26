const express = require('express');
const router = express.Router();
const solapiService = require('../../utils/solapiService');
const { authenticateToken, isManager } = require('../middleware/auth');
const { db } = require('../config/database');

/**
 * SOLAPI 템플릿 확인 엔드포인트
 * GET /api/test/template
 */
router.get('/template', authenticateToken, isManager, (req, res) => {
    const templateInfo = {
        templateId: process.env.SOLAPI_TEMPLATE_ID || 'KA01TP2510102016192182Rh5igl5PtG',
        pfId: process.env.SOLAPI_PFID || 'KA01PF251010200623410stJ4ZpKzQLv',
        expectedVariables: ['프로젝트명', '금액', '예금주', '은행명', '계좌번호'],
        templateExample: `[HV LAB 정산]
결제 요청이 도착했습니다.

프로젝트: #{프로젝트명}
금액: #{금액}원
예금주: #{예금주}
은행: #{은행명}
계좌번호: #{계좌번호}`,
        note: '템플릿 변수는 SOLAPI 관리자 페이지에서 확인하세요'
    };

    res.json(templateInfo);
});

/**
 * SOLAPI 알림톡 테스트 엔드포인트
 * POST /api/test/alimtalk
 */
router.post('/alimtalk', authenticateToken, isManager, async (req, res) => {
    try {
        console.log('📧 알림톡 테스트 시작...');

        // 테스트 데이터
        const testData = {
            projectName: '테스트 프로젝트',
            amount: 1234567,
            accountHolder: '홍길동',
            bankName: 'KB국민은행',
            accountNumber: '123-456-789012',
            requesterName: req.user.username || '테스트',
            itemName: '테스트 항목'
        };

        // 긴급 여부
        const isUrgent = req.body.urgent || false;

        // 알림톡 발송
        const results = await solapiService.sendPaymentNotification(testData, isUrgent);

        console.log('📧 알림톡 테스트 결과:', results);

        res.json({
            success: true,
            message: `테스트 알림톡이 ${isUrgent ? '긴급으로' : '일반으로'} 발송되었습니다`,
            results: results,
            testData: testData
        });

    } catch (error) {
        console.error('❌ 알림톡 테스트 실패:', error);
        res.status(500).json({
            success: false,
            error: '알림톡 테스트 실패',
            details: error.message
        });
    }
});

/**
 * SOLAPI 설정 확인 엔드포인트
 * GET /api/test/config
 */
router.get('/config', authenticateToken, isManager, (req, res) => {
    const config = {
        apiKeySet: !!process.env.SOLAPI_API_KEY,
        apiSecretSet: !!process.env.SOLAPI_API_SECRET,
        pfIdSet: !!process.env.SOLAPI_PFID,
        templateIdSet: !!process.env.SOLAPI_TEMPLATE_ID,
        fromNumberSet: !!process.env.SOLAPI_FROM_NUMBER,
        adminPhonesSet: !!process.env.ADMIN_PHONE_NUMBERS,
        adminPhoneCount: process.env.ADMIN_PHONE_NUMBERS ?
            process.env.ADMIN_PHONE_NUMBERS.split(',').length : 0
    };

    const allSet = Object.values(config).every(v => v === true || typeof v === 'number');

    res.json({
        configured: allSet,
        details: config,
        message: allSet ?
            '✅ SOLAPI가 올바르게 설정되었습니다' :
            '⚠️ 일부 환경변수가 설정되지 않았습니다'
    });
});

/**
 * 긴급 SMS 테스트 엔드포인트
 * POST /api/test/sms
 */
router.post('/sms', authenticateToken, isManager, async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                error: '전화번호와 메시지를 입력해주세요'
            });
        }

        // SMS 직접 발송
        const result = await solapiService.sendUrgentSMS(phoneNumber, {
            projectName: '테스트',
            amount: 1000000
        });

        res.json({
            success: true,
            message: 'SMS가 발송되었습니다',
            result: result
        });

    } catch (error) {
        console.error('❌ SMS 테스트 실패:', error);
        res.status(500).json({
            success: false,
            error: 'SMS 테스트 실패',
            details: error.message
        });
    }
});

/**
 * 데이터베이스 스키마 확인 엔드포인트
 * GET /api/test/check-payment-schema
 */
router.get('/check-payment-schema', (req, res) => {
    db.all("PRAGMA table_info(payment_requests)", [], (err, columns) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const columnNames = columns.map(col => col.name);
        const hasOriginalMaterial = columnNames.includes('original_material_amount');
        res.json({
            columns: columnNames,
            hasOriginalMaterialAmount: hasOriginalMaterial,
            totalColumns: columns.length,
            needsFix: !hasOriginalMaterial
        });
    });
});

/**
 * 데이터베이스 스키마 수정 엔드포인트
 * GET /api/test/fix-payment-schema
 */
router.get('/fix-payment-schema', (req, res) => {
    db.run(`
        ALTER TABLE payment_requests
        ADD COLUMN original_material_amount INTEGER DEFAULT 0
    `, (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                return res.json({
                    message: 'Column already exists',
                    status: 'ok'
                });
            }
            return res.status(500).json({
                error: 'Failed to add column',
                details: err.message
            });
        }
        res.json({
            message: 'Successfully added original_material_amount column',
            status: 'success'
        });
    });
});

module.exports = router;