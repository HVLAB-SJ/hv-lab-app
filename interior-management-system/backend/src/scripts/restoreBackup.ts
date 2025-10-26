import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function restoreBackup(backupFileName?: string) {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    // Find backup file
    const backupDir = path.resolve(__dirname, '../../backups');

    if (!fs.existsSync(backupDir)) {
      throw new Error('Backup directory does not exist');
    }

    let backupFile: string;

    if (backupFileName) {
      backupFile = path.join(backupDir, backupFileName);
    } else {
      // Get most recent backup
      const backupFiles = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (backupFiles.length === 0) {
        throw new Error('No backup files found');
      }

      backupFile = path.join(backupDir, backupFiles[0]);
    }

    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    console.log(`\n📂 Restoring from: ${path.basename(backupFile)}`);

    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
    console.log(`📅 Backup date: ${backupData.timestamp}`);

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will restore the database to the backup state.');
    console.log('   Current data will be preserved, but duplicates may occur.');
    console.log('\nCollections to restore:');

    for (const [collectionName, documents] of Object.entries(backupData.collections)) {
      console.log(`  - ${collectionName}: ${(documents as any[]).length} documents`);
    }

    console.log('\n🔄 Starting restore...\n');

    // Restore each collection
    for (const [collectionName, documents] of Object.entries(backupData.collections)) {
      try {
        const collection = db.collection(collectionName);
        const docs = documents as any[];

        if (docs.length > 0) {
          // Insert documents that don't exist
          let insertedCount = 0;
          for (const doc of docs) {
            const existing = await collection.findOne({ _id: doc._id });
            if (!existing) {
              await collection.insertOne(doc);
              insertedCount++;
            }
          }
          console.log(`✅ Restored ${collectionName}: ${insertedCount} new documents added`);
        }
      } catch (error) {
        console.error(`❌ Error restoring ${collectionName}:`, error);
      }
    }

    console.log('\n✨ Restore complete!');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during restore:', error);
    process.exit(1);
  }
}

// Get backup file from command line argument
const backupFileName = process.argv[2];
restoreBackup(backupFileName);
