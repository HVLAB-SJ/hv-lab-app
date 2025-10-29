const axios = require('axios');

const BASE_URL = 'https://hv-lab-app-production.up.railway.app';

async function runMigration() {
  try {
    console.log('🔐 로그인 중...');

    // 1. 로그인
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: '상준',
      password: '6b7820'
    });

    const token = loginResponse.data.token;
    console.log('✅ 로그인 성공');

    // 2. 마이그레이션 실행
    console.log('\n📋 일정 제목 마이그레이션 실행 중...');
    const migrateResponse = await axios.post(
      `${BASE_URL}/api/schedules/migrate-titles`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('\n✅ 마이그레이션 완료:');
    console.log(migrateResponse.data);

  } catch (error) {
    console.error('❌ 에러 발생:', error.response?.data || error.message);
  }
}

runMigration();
