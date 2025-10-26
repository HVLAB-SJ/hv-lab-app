import mongoose from 'mongoose';
import User from '../models/User.model';
import dotenv from 'dotenv';

dotenv.config();

const users = [
  { username: '상준', name: '상준', password: '0109', role: 'admin' as const },
  { username: '신애', name: '신애', password: '0109', role: 'manager' as const },
  { username: '재천', name: '재천', password: '0109', role: 'worker' as const },
  { username: '민기', name: '민기', password: '0109', role: 'worker' as const },
  { username: '재성', name: '재성', password: '0109', role: 'worker' as const },
  { username: '재현', name: '재현', password: '0109', role: 'worker' as const }
];

async function createUsers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/interior-management';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected');

    // Delete existing users (optional - for fresh start)
    // await User.deleteMany({});
    // console.log('🗑️  Existing users deleted');

    // Create users
    for (const userData of users) {
      const existingUser = await User.findOne({ username: userData.username });

      if (existingUser) {
        console.log(`⚠️  User ${userData.username} already exists, skipping...`);
        continue;
      }

      const user = new User(userData);
      await user.save();
      console.log(`✅ User created: ${userData.username} (${userData.name})`);
    }

    console.log('\n🎉 All users created successfully!');
    console.log('\n사용자 정보:');
    console.log('─'.repeat(50));
    users.forEach(u => {
      console.log(`  아이디: ${u.username} | 비밀번호: ${u.password} | 권한: ${u.role}`);
    });
    console.log('─'.repeat(50));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating users:', error);
    process.exit(1);
  }
}

createUsers();
