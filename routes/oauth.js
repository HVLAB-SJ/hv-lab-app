/**
 * 카카오 OAuth 콜백 처리 라우터
 */

const express = require('express');
const router = express.Router();
const kakaoMessage = require('../utils/kakaoMessage');

/**
 * 카카오 OAuth 콜백
 * 인증 코드를 받아서 액세스 토큰을 발급받고 저장
 */
router.get('/kakao', async (req, res) => {
    const { code, state, error, error_description } = req.query;

    // 에러 처리
    if (error) {
        console.error('카카오 인증 에러:', error, error_description);
        return res.status(400).send(`
            <html>
                <body>
                    <h2>인증 실패</h2>
                    <p>${error_description || error}</p>
                    <button onclick="window.close()">창 닫기</button>
                </body>
            </html>
        `);
    }

    try {
        // 인증 코드로 토큰 발급
        const tokens = await kakaoMessage.getTokens(code);

        // state에서 사용자 ID 추출 (실제로는 세션이나 JWT에서 가져와야 함)
        const userId = state || 'admin'; // 임시로 admin 사용

        // 토큰 저장
        kakaoMessage.saveToken(userId, tokens);

        // 성공 페이지 표시
        res.send(`
            <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                            text-align: center;
                        }
                        h2 {
                            color: #333;
                            margin-bottom: 20px;
                        }
                        .success-icon {
                            font-size: 60px;
                            margin-bottom: 20px;
                        }
                        p {
                            color: #666;
                            margin-bottom: 30px;
                        }
                        button {
                            background: #fee500;
                            color: #000;
                            border: none;
                            padding: 12px 30px;
                            border-radius: 5px;
                            font-size: 16px;
                            cursor: pointer;
                            transition: background 0.3s;
                        }
                        button:hover {
                            background: #fdd835;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="success-icon">✅</div>
                        <h2>카카오톡 연동 성공!</h2>
                        <p>이제 카카오톡으로 알림을 받을 수 있습니다.</p>
                        <button onclick="window.close()">창 닫기</button>
                    </div>
                    <script>
                        // 3초 후 자동으로 창 닫기
                        setTimeout(() => {
                            window.close();
                        }, 3000);
                    </script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('토큰 발급 실패:', error);
        res.status(500).send(`
            <html>
                <body>
                    <h2>토큰 발급 실패</h2>
                    <p>${error.message}</p>
                    <button onclick="window.close()">창 닫기</button>
                </body>
            </html>
        `);
    }
});

/**
 * 관리자 카카오 연동 페이지
 * 관리자가 카카오톡 알림을 받기 위해 최초 1회 인증 필요
 */
router.get('/kakao/connect', (req, res) => {
    const userId = req.query.userId || 'admin';
    const authUrl = kakaoMessage.getAuthUrl(userId);

    res.send(`
        <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: #f5f5f5;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 10px;
                        box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                        text-align: center;
                        max-width: 400px;
                    }
                    h2 {
                        color: #333;
                        margin-bottom: 20px;
                    }
                    p {
                        color: #666;
                        margin-bottom: 30px;
                        line-height: 1.6;
                    }
                    .kakao-btn {
                        background: #fee500;
                        color: #000;
                        text-decoration: none;
                        padding: 15px 30px;
                        border-radius: 5px;
                        display: inline-block;
                        font-size: 16px;
                        font-weight: bold;
                        transition: background 0.3s;
                    }
                    .kakao-btn:hover {
                        background: #fdd835;
                    }
                    .kakao-logo {
                        width: 20px;
                        height: 20px;
                        vertical-align: middle;
                        margin-right: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>카카오톡 알림 연동</h2>
                    <p>
                        결제 요청 알림을 카카오톡으로 받기 위해<br>
                        카카오 계정 연동이 필요합니다.
                    </p>
                    <a href="${authUrl}" class="kakao-btn">
                        카카오 로그인으로 연동하기
                    </a>
                </div>
            </body>
        </html>
    `);
});

module.exports = router;