import fs from 'fs';
import path from 'path';

function listBackups() {
  const backupDir = path.resolve(__dirname, '../../backups');

  if (!fs.existsSync(backupDir)) {
    console.log('⚠️  No backups directory found');
    return;
  }

  const backupFiles = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (backupFiles.length === 0) {
    console.log('⚠️  No backup files found');
    return;
  }

  console.log(`\n📋 Available backups (${backupFiles.length}):\n`);

  backupFiles.forEach((file, index) => {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    // Parse backup data to show summary
    try {
      const backup = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const projectCount = backup.collections?.projects?.length || 0;

      console.log(`${index + 1}. ${file}`);
      console.log(`   Date: ${backup.timestamp}`);
      console.log(`   Size: ${sizeKB} KB`);
      console.log(`   Projects: ${projectCount}`);
      console.log('');
    } catch (error) {
      console.log(`${index + 1}. ${file} (${sizeKB} KB)`);
      console.log('');
    }
  });

  console.log('\nTo restore a backup, run:');
  console.log('  npx ts-node src/scripts/restoreBackup.ts [backup-filename.json]');
  console.log('\nTo restore the most recent backup:');
  console.log('  npx ts-node src/scripts/restoreBackup.ts');
}

listBackups();
