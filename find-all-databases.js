const fs = require('fs');
const path = require('path');

function findDatabaseFiles(dir, results = [], depth = 0, maxDepth = 5) {
  if (depth > maxDepth) return results;

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);

      try {
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          // Skip node_modules and hidden directories
          if (file !== 'node_modules' && !file.startsWith('.') && !file.startsWith('$')) {
            findDatabaseFiles(filePath, results, depth + 1, maxDepth);
          }
        } else if (stat.isFile() && stat.size > 50000) {
          // Check if it's a database file (lowered threshold to 50KB)
          if (file.endsWith('.db') || file.endsWith('.sqlite') || file.endsWith('.sqlite3') || file === 'database') {
            results.push({
              path: filePath,
              size: stat.size,
              modified: stat.mtime
            });
          }
        }
      } catch (err) {
        // Skip files we can't access
      }
    }
  } catch (err) {
    // Skip directories we can't access
  }

  return results;
}

console.log('🔍 데스크탑에서 모든 데이터베이스 파일 검색 중...\n');

const desktopPath = 'C:\\Users\\kim_s\\Desktop';
const databases = findDatabaseFiles(desktopPath);

if (databases.length === 0) {
  console.log('❌ 50KB 이상의 데이터베이스 파일을 찾을 수 없습니다.');
} else {
  console.log(`✅ ${databases.length}개의 데이터베이스 파일 발견:\n`);

  // Sort by modification time (newest first)
  databases.sort((a, b) => b.modified - a.modified);

  databases.forEach((db, index) => {
    const sizeKB = Math.round(db.size / 1024);
    const dateStr = db.modified.toLocaleString('ko-KR');
    console.log(`${index + 1}. ${db.path}`);
    console.log(`   크기: ${sizeKB} KB`);
    console.log(`   수정: ${dateStr}\n`);
  });
}
