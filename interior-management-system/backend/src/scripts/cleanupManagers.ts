import mongoose from 'mongoose';
import Project from '../models/Project.model';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Valid team members
const VALID_MEMBERS = ['상준', '신애', '재천', '민기', '재성', '재현'];

async function cleanupManagers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all projects
    const projects = await Project.find({});
    console.log(`📋 Found ${projects.length} projects`);

    let updatedCount = 0;

    for (const project of projects) {
      let needsUpdate = false;
      let newManager: string | mongoose.Types.ObjectId | undefined = project.manager;

      // Clean up manager field - remove invalid names
      if (!project.manager) {
        // If manager is undefined or null, skip this project
        console.log(`⚠️  ${project.name}: Manager field is empty, skipping`);
        continue;
      }

      const managerString = typeof project.manager === 'string' ? project.manager : String(project.manager);
      const managerNames = managerString
        .split(',')
        .map((name: string) => name.trim())
        .filter((name: string) => VALID_MEMBERS.includes(name));

      if (managerNames.length === 0) {
        // If no valid managers, set to null (will be handled by fieldManagers)
        newManager = null as any;
        needsUpdate = true;
        console.log(`⚠️  ${project.name}: No valid managers found, clearing manager field`);
      } else if (managerNames.join(', ') !== managerString) {
        newManager = managerNames.join(', ');
        needsUpdate = true;
        console.log(`🔧 ${project.name}: "${managerString}" → "${newManager}"`);
      }

      if (needsUpdate) {
        await Project.findByIdAndUpdate(project._id, { manager: newManager });
        updatedCount++;
      }
    }

    console.log(`✅ Updated ${updatedCount} projects`);
    console.log('✨ Cleanup complete');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up managers:', error);
    process.exit(1);
  }
}

cleanupManagers();
