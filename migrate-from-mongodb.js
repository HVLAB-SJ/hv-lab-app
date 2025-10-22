/**
 * MongoDB to SQLite Migration Script
 *
 * This script migrates data from the old MongoDB backend to the new SQLite database.
 *
 * Usage:
 * 1. Make sure MONGODB_URI is set in .env
 * 2. Run: node migrate-from-mongodb.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:lPAuuiDaaIpckSmyCEaEBXPWArmAHtZn@yamanote.proxy.rlwy.net:24465/interior_management?authSource=admin';
const SQLITE_PATH = path.join(__dirname, 'interior-schedule.db');

async function migrate() {
  console.log('🔄 Starting migration from MongoDB to SQLite...\n');

  let mongoClient;
  const db = new sqlite3.Database(SQLITE_PATH);

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const mongodb = mongoClient.db();
    console.log('✅ Connected to MongoDB\n');

    // Migrate Users
    console.log('👤 Migrating users...');
    const users = await mongodb.collection('users').find({}).toArray();
    for (const user of users) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO users (id, username, password, name, role, department, phone, email, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user._id ? user._id.toString() : null,
            user.username,
            user.password,
            user.name || user.username,
            user.role || 'worker',
            user.department,
            user.phone,
            user.email,
            user.createdAt || new Date().toISOString()
          ],
          (err) => {
            if (err) {
              console.error(`  ❌ Error migrating user ${user.username}:`, err.message);
              resolve(); // Continue with next user
            } else {
              console.log(`  ✅ Migrated user: ${user.username}`);
              resolve();
            }
          }
        );
      });
    }
    console.log(`✅ Migrated ${users.length} users\n`);

    // Migrate Projects
    console.log('📁 Migrating projects...');
    const projects = await mongodb.collection('projects').find({}).toArray();
    for (const project of projects) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO projects (id, name, client, address, start_date, end_date, status, color, manager_id, manager_name, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            project._id ? project._id.toString() : null,
            project.name,
            typeof project.client === 'object' ? project.client.name : project.client,
            typeof project.location === 'object' ? project.location.address : project.location,
            project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : null,
            project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : null,
            project.status === 'inProgress' ? 'in-progress' : (project.status === 'onHold' ? 'on-hold' : project.status),
            project.colorCode || '#4A90E2',
            project.manager?._id ? project.manager._id.toString() : null,
            project.fieldManagers?.map(fm => typeof fm === 'object' ? fm.name : fm).join(', '),
            project.description,
            project.createdAt || new Date().toISOString()
          ],
          (err) => {
            if (err) {
              console.error(`  ❌ Error migrating project ${project.name}:`, err.message);
              resolve();
            } else {
              console.log(`  ✅ Migrated project: ${project.name}`);
              resolve();
            }
          }
        );
      });
    }
    console.log(`✅ Migrated ${projects.length} projects\n`);

    // Migrate Schedules
    console.log('📅 Migrating schedules...');
    const schedules = await mongodb.collection('schedules').find({}).toArray();
    for (const schedule of schedules) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO schedules (id, project_id, title, description, start_date, end_date, type, status, priority, color, assigned_to, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            schedule._id ? schedule._id.toString() : null,
            schedule.project?._id ? schedule.project._id.toString() : null,
            schedule.title,
            schedule.description,
            schedule.startDate ? new Date(schedule.startDate).toISOString().split('T')[0] : null,
            schedule.endDate ? new Date(schedule.endDate).toISOString().split('T')[0] : null,
            schedule.type || 'construction',
            schedule.status || 'pending',
            schedule.priority || 'normal',
            schedule.color,
            schedule.assignedTo?.map(a => typeof a === 'object' ? a.name : a).join(', '),
            schedule.createdBy?._id ? schedule.createdBy._id.toString() : null,
            schedule.createdAt || new Date().toISOString()
          ],
          (err) => {
            if (err) {
              console.error(`  ❌ Error migrating schedule ${schedule.title}:`, err.message);
              resolve();
            } else {
              console.log(`  ✅ Migrated schedule: ${schedule.title}`);
              resolve();
            }
          }
        );
      });
    }
    console.log(`✅ Migrated ${schedules.length} schedules\n`);

    console.log('✨ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Users: ${users.length}`);
    console.log(`  - Projects: ${projects.length}`);
    console.log(`  - Schedules: ${schedules.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log('\n📡 MongoDB connection closed');
    }
    db.close();
    console.log('💾 SQLite database closed');
  }
}

// Run migration
migrate().catch(console.error);
