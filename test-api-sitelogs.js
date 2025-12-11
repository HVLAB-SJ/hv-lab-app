const axios = require('axios');

const BASE_URL = 'https://hvlab.app';

async function testSiteLogs() {
  try {
    console.log('=== HV LAB API 현장일지 데이터 확인 ===\n');

    // 1. 로그인
    console.log('1. 로그인 시도...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: '상준',
      password: '6b7820'
    });

    const token = loginResponse.data.token;
    console.log('   ✅ 로그인 성공\n');

    // 2. 모든 현장일지 조회
    console.log('2. 현장일지 데이터 조회...');
    const logsResponse = await axios.get(`${BASE_URL}/api/site-logs`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const logs = logsResponse.data;
    console.log(`   📊 총 현장일지: ${logs.length}개\n`);

    if (logs.length > 0) {
      console.log('최근 현장일지 5개:');
      logs.slice(0, 5).forEach((log, idx) => {
        console.log(`\n[${idx + 1}] ${log.project}`);
        console.log(`    날짜: ${log.date}`);
        console.log(`    작성자: ${log.createdBy || log.created_by}`);
        console.log(`    이미지: ${log.images ? log.images.length : 0}개`);

        if (log.images && log.images.length > 0) {
          // 첫 이미지의 타입 확인
          const firstImg = log.images[0];
          if (firstImg.startsWith('data:image')) {
            const sizeKB = (firstImg.length * 0.75 / 1024).toFixed(2);
            console.log(`    첫 이미지: Base64 (약 ${sizeKB}KB)`);
          } else {
            console.log(`    첫 이미지: ${firstImg}`);
          }
        }
      });

      // 이미지 통계
      const totalImages = logs.reduce((sum, log) => sum + (log.images ? log.images.length : 0), 0);
      console.log(`\n=== 전체 통계 ===`);
      console.log(`총 이미지: ${totalImages}개`);

      // 프로젝트별 통계
      const projectStats = {};
      logs.forEach(log => {
        if (!projectStats[log.project]) {
          projectStats[log.project] = { logs: 0, images: 0 };
        }
        projectStats[log.project].logs++;
        projectStats[log.project].images += (log.images ? log.images.length : 0);
      });

      console.log('\n프로젝트별 현장일지:');
      Object.entries(projectStats).forEach(([project, stats]) => {
        console.log(`  - ${project}: ${stats.logs}개 일지, ${stats.images}개 이미지`);
      });
    } else {
      console.log('⚠️ 현장일지 데이터가 없습니다.');
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.response?.data?.error || error.message);
    if (error.response?.status === 401) {
      console.log('   인증 실패 - 로그인 정보를 확인하세요.');
    }
  }
}

testSiteLogs();