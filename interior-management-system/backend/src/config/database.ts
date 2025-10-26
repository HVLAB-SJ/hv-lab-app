import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/interior_management', {
      // Ensure UTF-8 encoding for proper Korean character support
      directConnection: false,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error}`);
    console.log('⚠️  서버는 계속 실행됩니다. MongoDB를 설치하고 실행하세요.');
    // process.exit(1); // MongoDB 없이도 계속 실행
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});