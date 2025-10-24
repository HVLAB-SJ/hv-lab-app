const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, isManager } = require('../middleware/auth');
const openBankingService = require('../services/openBankingService');

/**
 * 오픈뱅킹 인증 시작
 * GET /api/banking/auth/start
 */
router.get('/auth/start', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const authUrl = openBankingService.getAuthorizationUrl(userId);

    res.json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('[Banking Auth Start] Error:', error);
    res.status(500).json({
      success: false,
      message: '인증 URL 생성 중 오류가 발생했습니다'
    });
  }
});

/**
 * 오픈뱅킹 인증 콜백
 * GET /api/banking/auth/callback?code=xxx&state=xxx
 */
router.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // 인증 실패
  if (error) {
    console.error('[Banking Auth Callback] Error:', error);
    return res.redirect('/settings?banking=error&message=' + encodeURIComponent(error));
  }

  try {
    // State에서 사용자 ID 추출
    const userId = state.split('_')[0];

    // Access Token 발급
    const tokenResult = await openBankingService.getAccessToken(code);

    if (!tokenResult.success) {
      console.error('[Banking Auth Callback] Token error:', tokenResult.error);
      return res.redirect('/settings?banking=error&message=token_failed');
    }

    const tokenData = tokenResult.data;

    // 토큰 암호화
    const encryptedAccessToken = openBankingService.encryptToken(tokenData.access_token);
    const encryptedRefreshToken = openBankingService.encryptToken(tokenData.refresh_token);

    // 토큰을 데이터베이스에 저장
    db.run(
      `INSERT OR REPLACE INTO banking_tokens
       (user_id, access_token, refresh_token, scope, token_type, expires_at, user_seq_no, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'), ?, datetime('now'), datetime('now'))`,
      [
        userId,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenData.scope,
        tokenData.token_type,
        tokenData.expires_in,
        tokenData.user_seq_no,
      ],
      (err) => {
        if (err) {
          console.error('[Banking Auth Callback] DB error:', err);
          return res.redirect('/settings?banking=error&message=db_failed');
        }

        console.log('[Banking Auth Callback] Success for user:', userId);
        res.redirect('/settings?banking=success');
      }
    );
  } catch (error) {
    console.error('[Banking Auth Callback] Error:', error);
    res.redirect('/settings?banking=error&message=unknown');
  }
});

/**
 * 뱅킹 연동 상태 확인
 * GET /api/banking/status
 */
router.get('/status', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.get(
    `SELECT user_id, scope, expires_at, created_at, updated_at
     FROM banking_tokens
     WHERE user_id = ? AND expires_at > datetime('now')`,
    [userId],
    (err, row) => {
      if (err) {
        console.error('[Banking Status] DB error:', err);
        return res.status(500).json({
          success: false,
          message: '상태 조회 중 오류가 발생했습니다'
        });
      }

      res.json({
        success: true,
        connected: !!row,
        data: row ? {
          scope: row.scope,
          expiresAt: row.expires_at,
          connectedAt: row.created_at
        } : null
      });
    }
  );
});

/**
 * 뱅킹 연동 해제
 * DELETE /api/banking/disconnect
 */
router.delete('/disconnect', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.run(
    'DELETE FROM banking_tokens WHERE user_id = ?',
    [userId],
    function(err) {
      if (err) {
        console.error('[Banking Disconnect] DB error:', err);
        return res.status(500).json({
          success: false,
          message: '연동 해제 중 오류가 발생했습니다'
        });
      }

      res.json({
        success: true,
        message: '오픈뱅킹 연동이 해제되었습니다'
      });
    }
  );
});

/**
 * 송금 실행
 * POST /api/banking/transfer
 */
router.post('/transfer', authenticateToken, isManager, async (req, res) => {
  const {
    paymentId,
    bankCode,
    accountNumber,
    accountHolder,
    amount,
    purpose
  } = req.body;

  // 필수 파라미터 검증
  if (!paymentId || !bankCode || !accountNumber || !accountHolder || !amount) {
    return res.status(400).json({
      success: false,
      message: '필수 정보가 누락되었습니다'
    });
  }

  try {
    // 관리자의 오픈뱅킹 토큰 조회
    const tokenRow = await new Promise((resolve, reject) => {
      db.get(
        `SELECT access_token, refresh_token, expires_at
         FROM banking_tokens
         WHERE user_id = ?`,
        [req.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!tokenRow) {
      return res.status(400).json({
        success: false,
        message: '오픈뱅킹 연동이 필요합니다',
        requireAuth: true
      });
    }

    // 토큰 만료 확인
    const now = new Date();
    const expiresAt = new Date(tokenRow.expires_at);

    let accessToken = openBankingService.decryptToken(tokenRow.access_token);

    // 토큰이 만료되었으면 갱신
    if (now >= expiresAt) {
      console.log('[Banking Transfer] Token expired, refreshing...');
      const refreshToken = openBankingService.decryptToken(tokenRow.refresh_token);
      const refreshResult = await openBankingService.refreshAccessToken(refreshToken);

      if (!refreshResult.success) {
        return res.status(400).json({
          success: false,
          message: '토큰 갱신에 실패했습니다. 다시 인증해주세요',
          requireAuth: true
        });
      }

      // 새 토큰 저장
      const newTokenData = refreshResult.data;
      accessToken = newTokenData.access_token;

      const encryptedAccessToken = openBankingService.encryptToken(accessToken);
      const encryptedRefreshToken = openBankingService.encryptToken(newTokenData.refresh_token);

      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE banking_tokens
           SET access_token = ?, refresh_token = ?, expires_at = datetime('now', '+' || ? || ' seconds'), updated_at = datetime('now')
           WHERE user_id = ?`,
          [encryptedAccessToken, encryptedRefreshToken, newTokenData.expires_in, req.user.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // 회사 계좌 정보 조회 (환경 변수에서)
    const fintechUseNum = process.env.COMPANY_FINTECH_USE_NUM;

    if (!fintechUseNum) {
      return res.status(500).json({
        success: false,
        message: '회사 계좌 설정이 필요합니다'
      });
    }

    // 송금 실행
    console.log('[Banking Transfer] Initiating transfer:', {
      paymentId,
      to: `${bankCode}-${accountNumber}`,
      amount,
      purpose
    });

    const transferResult = await openBankingService.transfer({
      accessToken: accessToken,
      fintechUseNum: fintechUseNum,
      bankCode: bankCode,
      accountNumber: accountNumber,
      accountHolder: accountHolder,
      amount: amount,
      purpose: purpose || `결제요청 #${paymentId}`,
      withdrawAccountHolder: process.env.COMPANY_ACCOUNT_HOLDER || '회사명',
      reqClientNum: String(req.user.id)
    });

    if (!transferResult.success) {
      console.error('[Banking Transfer] Failed:', transferResult.error);
      return res.status(400).json({
        success: false,
        message: transferResult.error.message || '송금에 실패했습니다',
        code: transferResult.error.code
      });
    }

    // 송금 성공 - 결제 요청 상태 업데이트
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE payment_requests
         SET status = 'completed',
             paid_at = datetime('now'),
             updated_at = datetime('now'),
             notes = CASE
               WHEN notes IS NULL OR notes = '' THEN ?
               ELSE notes || '\n' || ?
             END
         WHERE id = ?`,
        [
          `[자동송금] ${transferResult.data.transactionId}`,
          `[자동송금] ${transferResult.data.transactionId}`,
          paymentId
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // 송금 기록 저장
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO banking_transactions
         (payment_id, user_id, transaction_id, bank_code, account_number, account_holder, amount, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now'))`,
        [
          paymentId,
          req.user.id,
          transferResult.data.transactionId,
          bankCode,
          accountNumber,
          accountHolder,
          amount
        ],
        (err) => {
          if (err) {
            console.error('[Banking Transfer] Transaction log error:', err);
            // 로그 저장 실패는 무시 (송금은 성공했으므로)
          }
          resolve();
        }
      );
    });

    console.log('[Banking Transfer] Success:', transferResult.data);

    res.json({
      success: true,
      message: '송금이 완료되었습니다',
      data: {
        transactionId: transferResult.data.transactionId,
        amount: transferResult.data.amount,
        timestamp: transferResult.data.timestamp
      }
    });
  } catch (error) {
    console.error('[Banking Transfer] Error:', error);
    res.status(500).json({
      success: false,
      message: '송금 처리 중 오류가 발생했습니다'
    });
  }
});

/**
 * 송금 내역 조회
 * GET /api/banking/transactions
 */
router.get('/transactions', authenticateToken, isManager, (req, res) => {
  const { limit = 50 } = req.query;

  db.all(
    `SELECT
       bt.*,
       pr.purpose,
       pr.project_id,
       p.name as project_name,
       u.username as transferred_by
     FROM banking_transactions bt
     LEFT JOIN payment_requests pr ON bt.payment_id = pr.id
     LEFT JOIN projects p ON pr.project_id = p.id
     LEFT JOIN users u ON bt.user_id = u.id
     ORDER BY bt.created_at DESC
     LIMIT ?`,
    [parseInt(limit)],
    (err, rows) => {
      if (err) {
        console.error('[Banking Transactions] DB error:', err);
        return res.status(500).json({
          success: false,
          message: '내역 조회 중 오류가 발생했습니다'
        });
      }

      res.json({
        success: true,
        data: rows
      });
    }
  );
});

module.exports = router;
