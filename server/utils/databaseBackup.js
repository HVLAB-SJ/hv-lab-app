const fs = require('fs');
const path = require('path');

/**
 * 데이터베이스 자동 백업 유틸리티
 * - 매일 자정(00:00)에 자동 백업
 * - 최근 30일치 백업만 보관
 * - backups/ 디렉토리에 저장
 */

const DB_FILE = path.join(__dirname, '../../database.db');
const BACKUP_DIR = path.join(__dirname, '../../backups');
const BACKUP_RETENTION_DAYS = 30; // 보관 기간 (일)

/**
 * 백업 디렉토리 생성
 */
function ensureBackupDirectory() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 백업 디렉토리 생성: ${BACKUP_DIR}`);
  }
}

/**
 * 데이터베이스 백업 실행
 */
function backupDatabase() {
  try {
    ensureBackupDirectory();

    // 백업 파일명: database-backup-YYYY-MM-DD.db
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    const backupFileName = `database-backup-${dateStr}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // 데이터베이스 파일이 존재하는지 확인
    if (!fs.existsSync(DB_FILE)) {
      console.error('❌ 데이터베이스 파일을 찾을 수 없습니다:', DB_FILE);
      return false;
    }

    // 파일 복사
    fs.copyFileSync(DB_FILE, backupPath);

    // 파일 크기 확인
    const stats = fs.statSync(backupPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    console.log(`✅ 데이터베이스 백업 완료!`);
    console.log(`   📁 파일: ${backupFileName}`);
    console.log(`   📊 크기: ${fileSizeKB} KB`);
    console.log(`   ⏰ 시간: ${timestamp.toLocaleString('ko-KR')}`);

    // 오래된 백업 정리
    cleanOldBackups();

    return true;
  } catch (error) {
    console.error('❌ 백업 실패:', error);
    return false;
  }
}

/**
 * 오래된 백업 파일 정리
 * BACKUP_RETENTION_DAYS보다 오래된 백업 파일 삭제
 */
function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files.filter(f => f.startsWith('database-backup-') && f.endsWith('.db'));

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);

    let deletedCount = 0;

    backupFiles.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const fileDate = new Date(stats.mtime);

      if (fileDate < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`   🗑️  삭제: ${file} (${fileDate.toLocaleDateString('ko-KR')})`);
      }
    });

    if (deletedCount > 0) {
      console.log(`   ✅ ${deletedCount}개의 오래된 백업 파일 삭제됨`);
    }

    // 현재 백업 파일 목록
    const remainingFiles = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('database-backup-') && f.endsWith('.db'));
    console.log(`   💾 현재 백업 파일 수: ${remainingFiles.length}개`);

  } catch (error) {
    console.error('⚠️  오래된 백업 정리 중 오류:', error);
  }
}

/**
 * 백업 파일 목록 조회
 */
function listBackups() {
  try {
    ensureBackupDirectory();

    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files
      .filter(f => f.startsWith('database-backup-') && f.endsWith('.db'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          fileName: file,
          filePath: filePath,
          size: stats.size,
          created: stats.mtime,
          sizeKB: (stats.size / 1024).toFixed(2)
        };
      })
      .sort((a, b) => b.created - a.created); // 최신순 정렬

    return backupFiles;
  } catch (error) {
    console.error('백업 목록 조회 실패:', error);
    return [];
  }
}

/**
 * 특정 백업 파일로 복원
 */
function restoreFromBackup(backupFileName) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    if (!fs.existsSync(backupPath)) {
      console.error('❌ 백업 파일을 찾을 수 없습니다:', backupFileName);
      return false;
    }

    // 현재 DB를 임시 백업
    const tempBackup = path.join(BACKUP_DIR, `temp-before-restore-${Date.now()}.db`);
    fs.copyFileSync(DB_FILE, tempBackup);

    // 백업 파일로 복원
    fs.copyFileSync(backupPath, DB_FILE);

    console.log(`✅ 데이터베이스 복원 완료!`);
    console.log(`   📁 복원 파일: ${backupFileName}`);
    console.log(`   💾 이전 DB 백업: ${path.basename(tempBackup)}`);

    return true;
  } catch (error) {
    console.error('❌ 복원 실패:', error);
    return false;
  }
}

module.exports = {
  backupDatabase,
  cleanOldBackups,
  listBackups,
  restoreFromBackup,
  ensureBackupDirectory
};
