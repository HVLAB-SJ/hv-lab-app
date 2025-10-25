const axios = require('axios');

async function testContractorsAPI() {
  try {
    console.log('=== Contractors API 테스트 ===\n');

    // 먼저 로그인
    console.log('1. 로그인 중...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    const token = loginResponse.data.token;
    console.log('✅ 로그인 성공\n');

    // contractors API 호출
    console.log('2. /api/contractors 호출 중...');
    const contractorsResponse = await axios.get('http://localhost:5001/api/contractors', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const contractors = contractorsResponse.data;
    console.log(`✅ ${contractors.length}개의 협력업체 데이터 수신\n`);

    // 목공 관련 협력업체 필터링
    console.log('3. 목공 관련 협력업체 확인:');
    console.log('----------------------------------------');

    const mokgongContractors = contractors.filter(c =>
      c.process === '목공사' || c.process === '목공' ||
      (c.companyName && c.companyName.includes('목공'))
    );

    mokgongContractors.forEach(contractor => {
      console.log(`\n[${contractor.process}] ${contractor.companyName || contractor.name}`);
      console.log(`  _id: ${contractor._id}`);
      console.log(`  name (담당자): "${contractor.name}"`);
      console.log(`  position: "${contractor.position || '없음'}"`);
      console.log(`  rank: ${contractor.rank || '없음'}`);

      // 이름에 직책이 포함되어 있는지 체크
      if (contractor.name && contractor.name.includes('반장')) {
        console.log('  ⚠️  WARNING: name 필드에 "반장"이 포함되어 있습니다!');
      }
    });

    // 성정현 특별 체크
    console.log('\n\n4. "성정현" 관련 데이터 특별 확인:');
    console.log('----------------------------------------');

    const seongContractors = contractors.filter(c =>
      (c.name && c.name.includes('성정현')) ||
      (c.companyName && c.companyName.includes('성정현'))
    );

    if (seongContractors.length > 0) {
      seongContractors.forEach(contractor => {
        console.log(`\nID: ${contractor._id}`);
        console.log(`  companyName: "${contractor.companyName}"`);
        console.log(`  name: "${contractor.name}"`);
        console.log(`  position: "${contractor.position || '없음'}"`);
        console.log(`  process: "${contractor.process}"`);

        if (contractor.name === '성정현반장') {
          console.log('\n  🔴 문제 발견: name이 "성정현반장"으로 되어 있습니다!');
          console.log('     → 백엔드 API가 잘못된 데이터를 전송하고 있습니다.');
        }
      });
    } else {
      console.log('성정현 관련 데이터를 찾을 수 없습니다.');
    }

  } catch (error) {
    console.error('API 테스트 실패:', error.response?.data || error.message);
  }
}

testContractorsAPI();