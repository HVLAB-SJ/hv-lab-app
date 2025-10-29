const express = require('express');
const router = express.Router();
const coolsmsService = require('../../utils/coolsmsService');
const { authenticateToken, isManager } = require('../middleware/auth');
const { db } = require('../config/database');

/**
 * 서버 상태 확인 (인증 불필요)
 * GET /api/test/health
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Server is running'
    });
});

/**
 * CoolSMS 설정 확인 엔드포인트
 * GET /api/test/template
 */
router.get('/template', authenticateToken, isManager, (req, res) => {
    const smsInfo = {
        service: 'CoolSMS',
        fromNumber: process.env.COOLSMS_FROM_NUMBER || '01074088864',
        adminPhones: process.env.ADMIN_PHONE_NUMBERS ? process.env.ADMIN_PHONE_NUMBERS.split(',') : [],
        messageExample: `[HV LAB 결제요청]
프로젝트: 테스트 프로젝트
금액: 100,000원
항목: 테스트 자재

KB국민은행
123-456-789012
예금주: 홍길동`,
        configured: !!process.env.COOLSMS_API_KEY && !!process.env.COOLSMS_API_SECRET
    };

    res.json(smsInfo);
});

/**
 * CoolSMS 문자 테스트 엔드포인트
 * POST /api/test/alimtalk
 */
router.post('/alimtalk', authenticateToken, isManager, async (req, res) => {
    try {
        console.log('📧 SMS 테스트 시작...');

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

        // SMS 발송
        const results = await coolsmsService.sendPaymentNotification(testData);

        console.log('📧 SMS 테스트 결과:', results);

        res.json({
            success: true,
            message: '테스트 SMS가 발송되었습니다',
            results: results,
            testData: testData
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
 * CoolSMS 설정 확인 엔드포인트
 * GET /api/test/config
 */
router.get('/config', authenticateToken, isManager, (req, res) => {
    const config = {
        apiKeySet: !!process.env.COOLSMS_API_KEY,
        apiSecretSet: !!process.env.COOLSMS_API_SECRET,
        fromNumberSet: !!process.env.COOLSMS_FROM_NUMBER,
        adminPhonesSet: !!process.env.ADMIN_PHONE_NUMBERS,
        adminPhoneCount: process.env.ADMIN_PHONE_NUMBERS ?
            process.env.ADMIN_PHONE_NUMBERS.split(',').length : 0
    };

    const allSet = Object.values(config).every(v => v === true || typeof v === 'number');

    res.json({
        configured: allSet,
        details: config,
        message: allSet ?
            '✅ CoolSMS가 올바르게 설정되었습니다' :
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
 * 데이터베이스 스키마 확인 엔드포인트 (인증 불필요)
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
 * 데이터베이스 스키마 수정 엔드포인트 (인증 불필요)
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

/**
 * 결제 요청 테스트 업데이트 (디버깅용)
 * PUT /api/test/payment/:id
 */
router.put('/payment/:id', (req, res) => {
    const { id } = req.params;
    console.log('Test payment update for ID:', id);
    console.log('Request body:', req.body);

    // 먼저 해당 결제 요청이 존재하는지 확인
    db.get('SELECT * FROM payment_requests WHERE id = ?', [id], (err, payment) => {
        if (err) {
            console.error('Error checking payment:', err);
            return res.status(500).json({
                error: 'Database error',
                details: err.message
            });
        }

        if (!payment) {
            return res.status(404).json({
                error: 'Payment not found',
                id: id
            });
        }

        // 간단한 업데이트 테스트
        const { notes } = req.body;
        db.run(
            'UPDATE payment_requests SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [notes || payment.notes, id],
            function(updateErr) {
                if (updateErr) {
                    console.error('Update error:', updateErr);
                    return res.status(500).json({
                        error: 'Update failed',
                        details: updateErr.message,
                        sql: updateErr.sql
                    });
                }

                res.json({
                    message: 'Test update successful',
                    payment: payment,
                    changes: this.changes
                });
            }
        );
    });
});

module.exports = router;