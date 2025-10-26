import mongoose from 'mongoose';
import Project from '../models/Project.model';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkClientData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all projects
    const projects = await Project.find({}).limit(5);
    console.log(`📋 Found ${projects.length} projects\n`);

    projects.forEach((project) => {
      console.log('----------------------------');
      console.log(`Project: ${project.name}`);
      console.log(`Client type: ${typeof project.client}`);
      console.log(`Client value:`, JSON.stringify(project.client, null, 2));
      console.log(`Manager type: ${typeof project.manager}`);
      console.log(`Manager value:`, project.manager);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking client data:', error);
    process.exit(1);
  }
}

checkClientData();
