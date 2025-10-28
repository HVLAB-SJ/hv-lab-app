const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'interior-management';

async function updateUserRole() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    
    // 먼저 상준님 찾기
    const user = await usersCollection.findOne({
      $or: [
        { name: /상준/i },
        { username: /상준/i }
      ]
    });
    
    if (user) {
      console.log('Found user:', user);
      
      // admin으로 업데이트
      const result = await usersCollection.updateOne(
        { _id: user._id },
        { $set: { role: 'admin' } }
      );
      
      console.log('✅ Update result:', result);
      
      // 업데이트된 정보 확인
      const updated = await usersCollection.findOne({ _id: user._id });
      console.log('Updated user:', updated);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

updateUserRole();
