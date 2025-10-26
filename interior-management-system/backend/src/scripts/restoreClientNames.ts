import mongoose from 'mongoose';
import Project from '../models/Project.model';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function restoreClientNames() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Update 원베일리 34py
    const wonbailey = await Project.findOne({ name: '원베일리 34py' });
    if (wonbailey) {
      wonbailey.client.name = '하민지';
      await wonbailey.save();
      console.log('✅ Updated 원베일리 34py: client.name = "하민지"');
    } else {
      console.log('⚠️  원베일리 34py not found');
    }

    // Update 올바른 필라테스
    const pilates = await Project.findOne({ name: '올바른 필라테스' });
    if (pilates) {
      pilates.client.name = '신창재';
      await pilates.save();
      console.log('✅ Updated 올바른 필라테스: client.name = "신창재"');
    } else {
      console.log('⚠️  올바른 필라테스 not found');
    }

    // Verify updates
    console.log('\n📋 Verification:');
    const projects = await Project.find({});
    projects.forEach((project) => {
      console.log(`  - ${project.name}: ${project.client.name}`);
    });

    console.log('\n✨ Client names restored successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error restoring client names:', error);
    process.exit(1);
  }
}

restoreClientNames();
