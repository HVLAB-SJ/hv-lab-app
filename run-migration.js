const https = require('https');

const BASE_URL = 'hvlab.app';
const PROJECT_ID = 6; // 대림아크로텔_엄상진님

// First, login to get token
const loginData = JSON.stringify({
  username: 'manager1',
  password: 'manager1'
});

const loginOptions = {
  hostname: BASE_URL,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

console.log('로그인 중...');

const loginReq = https.request(loginOptions, (loginRes) => {
  let loginBody = '';

  loginRes.on('data', (chunk) => {
    loginBody += chunk;
  });

  loginRes.on('end', () => {
    try {
      const loginResponse = JSON.parse(loginBody);

      if (!loginResponse.token) {
        console.error('로그인 실패:', loginBody);
        return;
      }

      console.log('✓ 로그인 성공');

      // Now call the migration endpoint
      const migrationOptions = {
        hostname: BASE_URL,
        path: `/api/finish-check/migrate-to-project/${PROJECT_ID}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${loginResponse.token}`,
          'Content-Type': 'application/json'
        }
      };

      console.log(`\n마이그레이션 실행 중 (프로젝트 ID: ${PROJECT_ID})...`);

      const migrationReq = https.request(migrationOptions, (migrationRes) => {
        let migrationBody = '';

        migrationRes.on('data', (chunk) => {
          migrationBody += chunk;
        });

        migrationRes.on('end', () => {
          try {
            const migrationResponse = JSON.parse(migrationBody);
            console.log('\n✅ 마이그레이션 완료!');
            console.log(JSON.stringify(migrationResponse, null, 2));
          } catch (e) {
            console.error('응답 파싱 오류:', migrationBody);
          }
        });
      });

      migrationReq.on('error', (e) => {
        console.error('마이그레이션 요청 실패:', e);
      });

      migrationReq.end();

    } catch (e) {
      console.error('로그인 응답 파싱 오류:', e);
      console.error('응답 내용:', loginBody);
    }
  });
});

loginReq.on('error', (e) => {
  console.error('로그인 요청 실패:', e);
});

loginReq.write(loginData);
loginReq.end();
