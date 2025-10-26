import mongoose from 'mongoose';
import Project from '../models/Project.model';
import User from '../models/User.model';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkAllProjects() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all projects (without populate to avoid schema issues)
    const projects = await Project.find({})
      .sort({ createdAt: -1 });

    console.log(`\n📋 Total projects in database: ${projects.length}\n`);

    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name}`);
      console.log(`   Status: ${project.status}`);
      console.log(`   Client: ${project.client.name}`);
      console.log(`   Location: ${project.location.address}`);
      console.log(`   Created: ${project.createdAt}`);
      console.log(`   Manager: ${typeof project.manager === 'object' && 'name' in project.manager ? project.manager.name : project.manager}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking projects:', error);
    process.exit(1);
  }
}

checkAllProjects();
