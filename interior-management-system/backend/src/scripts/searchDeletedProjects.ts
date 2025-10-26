import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function searchDeletedProjects() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get database
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Available collections:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });

    // Search in projects collection
    console.log('\n🔍 Searching for "황학동" or "롯데캐슬" in projects...');
    const projectsCollection = db.collection('projects');
    const searchResults = await projectsCollection.find({
      $or: [
        { name: /황학동/i },
        { name: /롯데캐슬/i },
        { name: /베네치아/i },
        { 'client.name': /황학동/i },
        { 'location.address': /황학동/i }
      ]
    }).toArray();

    if (searchResults.length > 0) {
      console.log(`\n✅ Found ${searchResults.length} matching project(s):`);
      searchResults.forEach((project: any) => {
        console.log('\n----------------------------');
        console.log(`Project: ${project.name}`);
        console.log(`Client: ${project.client?.name || 'N/A'}`);
        console.log(`Location: ${project.location?.address || 'N/A'}`);
        console.log(`Status: ${project.status}`);
        console.log(`Budget: ${project.budget || 0}`);
        console.log(`Start: ${project.startDate}`);
        console.log(`End: ${project.endDate}`);
        console.log(`Created: ${project.createdAt}`);
        console.log(`ID: ${project._id}`);
      });
    } else {
      console.log('\n⚠️  No matching projects found in database');
    }

    // Check if there are any deleted projects (soft delete flag)
    console.log('\n🔍 Checking for soft-deleted projects...');
    const deletedProjects = await projectsCollection.find({
      deleted: true
    }).toArray();

    if (deletedProjects.length > 0) {
      console.log(`\n✅ Found ${deletedProjects.length} deleted project(s):`);
      deletedProjects.forEach((project: any) => {
        console.log(`  - ${project.name}`);
      });
    } else {
      console.log('  No soft-deleted projects found');
    }

    // Get total count of all projects
    const totalProjects = await projectsCollection.countDocuments();
    console.log(`\n📊 Total projects in database: ${totalProjects}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error searching projects:', error);
    process.exit(1);
  }
}

searchDeletedProjects();
