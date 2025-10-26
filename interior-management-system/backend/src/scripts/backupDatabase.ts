import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function backupDatabase() {
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

    // Create backup directory
    const backupDir = path.resolve(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Create timestamp for backup file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);

    // Collections to backup
    const collectionsToBackup = ['projects', 'schedules', 'payments', 'contractors', 'constructionpayments', 'asrequests', 'users'];

    const backup: any = {
      timestamp: new Date().toISOString(),
      collections: {}
    };

    // Backup each collection
    for (const collectionName of collectionsToBackup) {
      try {
        const collection = db.collection(collectionName);
        const documents = await collection.find({}).toArray();
        backup.collections[collectionName] = documents;
        console.log(`✅ Backed up ${collectionName}: ${documents.length} documents`);
      } catch (error) {
        console.log(`⚠️  Collection ${collectionName} not found, skipping...`);
      }
    }

    // Write backup to file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`\n✅ Backup saved to: ${backupFile}`);

    // Keep only last 30 backups
    const backupFiles = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (backupFiles.length > 30) {
      const filesToDelete = backupFiles.slice(30);
      filesToDelete.forEach(file => {
        fs.unlinkSync(path.join(backupDir, file));
        console.log(`🗑️  Deleted old backup: ${file}`);
      });
    }

    console.log(`\n📊 Total backups: ${Math.min(backupFiles.length, 30)}`);
    console.log('✨ Backup complete!');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during backup:', error);
    process.exit(1);
  }
}

backupDatabase();
