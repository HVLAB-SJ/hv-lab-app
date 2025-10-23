const { MongoClient } = require('mongodb');
const uri = 'mongodb://mongo:lPAuuiDaaIpckSmyCEaEBXPWArmAHtZn@yamanote.proxy.rlwy.net:24465/interior_management?authSource=admin';

async function checkData() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ MongoDB 연결 성공\n');

    const db = client.db();
    const collections = await db.listCollections().toArray();

    console.log('📁 컬렉션 목록:');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`  - ${col.name}: ${count}개`);
    }

    console.log('\n📊 상세 데이터:');

    // 협력업체 데이터 확인
    if (collections.find(c => c.name === 'contractors')) {
      const contractors = await db.collection('contractors').find({}).limit(5).toArray();
      console.log(`\n협력업체 (총 ${await db.collection('contractors').countDocuments()}개):`);
      contractors.forEach(c => console.log(`  - ${c.name || c.companyName || c._id}`));
    } else {
      console.log('\n협력업체: 컬렉션 없음');
    }

    // 프로젝트 데이터 확인
    if (collections.find(c => c.name === 'projects')) {
      const projects = await db.collection('projects').find({}).limit(5).toArray();
      console.log(`\n프로젝트 (총 ${await db.collection('projects').countDocuments()}개):`);
      projects.forEach(p => console.log(`  - ${p.name}`));
    } else {
      console.log('\n프로젝트: 컬렉션 없음');
    }

    // 사용자 데이터 확인
    if (collections.find(c => c.name === 'users')) {
      const users = await db.collection('users').find({}).toArray();
      console.log(`\n사용자 (총 ${users.length}명):`);
      users.forEach(u => console.log(`  - ${u.name || u.username} (${u.role || 'role 없음'})`));
    } else {
      console.log('\n사용자: 컬렉션 없음');
    }

    // 일정 데이터 확인
    if (collections.find(c => c.name === 'schedules')) {
      const count = await db.collection('schedules').countDocuments();
      console.log(`\n일정: 총 ${count}개`);
    }

    // 결제 데이터 확인
    if (collections.find(c => c.name === 'payments')) {
      const count = await db.collection('payments').countDocuments();
      console.log(`결제: 총 ${count}개`);
    }

    // AS 요청 확인
    if (collections.find(c => c.name === 'asrequests')) {
      const count = await db.collection('asrequests').countDocuments();
      console.log(`AS 요청: 총 ${count}개`);
    }

  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await client.close();
  }
}

checkData();
