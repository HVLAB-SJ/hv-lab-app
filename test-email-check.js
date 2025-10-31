const axios = require('axios');

const RAILWAY_URL = 'https://hv-lab-app-production.up.railway.app';

console.log('📧 이메일 수동 확인 테스트...\n');

// 관리자 토큰이 필요하므로, 먼저 로그인
axios.post(`${RAILWAY_URL}/api/auth/login`, {
  username: 'admin',
  password: 'hvlab2024!'
})
.then(loginResponse => {
  const token = loginResponse.data.token;
  console.log('✅ 로그인 성공\n');

  // 이메일 확인 API 호출
  return axios.post(
    `${RAILWAY_URL}/api/quote-inquiries/check-email`,
    {},
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
})
.then(response => {
  console.log('✅ 이메일 확인 결과:');
  console.log(JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.error('❌ 에러 발생:');
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
  } else {
    console.error('Error:', error.message);
  }
});
