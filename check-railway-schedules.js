const axios = require('axios');
require('dotenv').config();

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || 'https://hv-lab-app-production.up.railway.app';

async function checkSchedules() {
  try {
    // Login first
    const loginResponse = await axios.post(`${RAILWAY_API_URL}/api/auth/login`, {
      username: '상준',
      password: 'Sonjoon7!'
    });

    const token = loginResponse.data.token;
    console.log('✅ 로그인 성공\n');

    // Get schedules
    const schedulesResponse = await axios.get(`${RAILWAY_API_URL}/api/schedules`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const schedules = schedulesResponse.data;
    console.log(`📅 총 일정 개수: ${schedules.length}\n`);

    // Show recent 10 schedules
    console.log('최근 일정 10개:\n');
    schedules.slice(0, 10).forEach((schedule, i) => {
      console.log(`${i + 1}. ${schedule.title || '(제목 없음)'}`);
      console.log(`   ID: ${schedule._id}`);
      console.log(`   날짜: ${schedule.start}`);
      console.log(`   담당자: ${schedule.attendees ? schedule.attendees.join(', ') : '(없음)'}`);
      console.log('');
    });

    // Check for team names in assignees
    const withTeamNames = schedules.filter(s =>
      s.attendees && (
        s.attendees.includes('HV LAB') ||
        s.attendees.includes('현장팀') ||
        s.attendees.includes('디자인팀')
      )
    );

    console.log(`\n🎯 팀 이름이 포함된 일정: ${withTeamNames.length}개`);
    withTeamNames.forEach((schedule, i) => {
      console.log(`${i + 1}. ${schedule.title}`);
      console.log(`   담당자: ${schedule.attendees.join(', ')}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkSchedules();
