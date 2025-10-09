const express = require('express');
const router = express.Router();
const kakaoMessage = require('../../utils/kakaoMessage');

// 카카오 인증 페이지로 리다이렉트
router.get('/kakao/connect', (req, res) => {
  const authUrl = kakaoMessage.getAuthUrl();
  res.redirect(authUrl);
});

// 카카오 OAuth 콜백 처리
router.get('/kakao', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('인증 코드가 없습니다.');
  }

  try {
    // 토큰 획득
    const tokens = await kakaoMessage.getTokens(code);

    // 토큰 저장 (관리자로 가정)
    const adminId = process.env.KAKAO_ADMIN_IDS?.split(',')[0] || 'admin';
    kakaoMessage.saveToken(adminId, tokens);

    // 테스트 메시지 발송
    await kakaoMessage.sendToMe(tokens.accessToken,
      '✅ 카카오톡 알림 연동이 완료되었습니다!\n\n이제 HV LAB 시스템에서 결제 요청 알림을 받으실 수 있습니다.');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>인증 완료</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { color: green; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ 카카오톡 연동 완료!</h1>
        <p>이제 결제 요청 알림을 카카오톡으로 받으실 수 있습니다.</p>
        <a href="/">메인으로 돌아가기</a>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('카카오 인증 오류:', error);
    res.status(500).send('인증 처리 중 오류가 발생했습니다.');
  }
});

module.exports = router;