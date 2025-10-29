const axios = require('axios');

const BASE_URL = 'https://hv-lab-app-production.up.railway.app';

async function checkAssignees() {
  try {
    console.log('🔐 로그인 중...');

    // 1. 로그인
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: '상준',
      password: '6b7820'
    });

    const token = loginResponse.data.token;
    console.log('✅ 로그인 성공');

    // 2. 일정 목록 조회
    console.log('\n📋 일정 목록 조회 중...');
    const schedulesResponse = await axios.get(
      `${BASE_URL}/api/schedules`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const schedules = schedulesResponse.data;
    console.log(`\n총 ${schedules.length}개의 일정 찾음`);

    // 최근 5개 일정의 담당자 정보 출력
    const recentSchedules = schedules.slice(0, 5);
    console.log('\n최근 5개 일정의 담당자 정보:');
    recentSchedules.forEach(schedule => {
      console.log(`\n일정 ID ${schedule._id}: ${schedule.title}`);
      console.log('  assignedTo:', schedule.assignedTo);
      console.log('  assigneeNames:', schedule.assigneeNames);
    });

  } catch (error) {
    console.error('❌ 에러 발생:', error.response?.data || error.message);
  }
}

checkAssignees();
