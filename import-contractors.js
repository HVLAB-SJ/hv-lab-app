/**
 * Import Contractor Data to SQLite
 *
 * Imports contractor data from CSV file into SQLite database
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DB_PATH = path.join(__dirname, 'database.db');
const CSV_PATH = 'C:/Users/kim_s/Desktop/인테리어 협력업체 연락처 285ffc3229ec401f95cd665453ba86a6_all.csv';

async function importContractors() {
  console.log('📋 협력업체 데이터 Import 시작...\n');

  const db = new sqlite3.Database(DB_PATH);

  try {
    // Read CSV file
    const fileStream = fs.createReadStream(CSV_PATH, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineNumber = 0;
    let importCount = 0;
    let skipCount = 0;

    for await (const line of rl) {
      lineNumber++;

      // Skip header
      if (lineNumber === 1) {
        console.log('📄 CSV 헤더:', line.substring(0, 100) + '...\n');
        continue;
      }

      // Parse CSV line (simple parser - may need adjustment for complex cases)
      const fields = line.split(',');

      if (fields.length < 4) {
        console.log(`⚠️  라인 ${lineNumber}: 필드 부족 (건너뜀)`);
        skipCount++;
        continue;
      }

      const name = fields[0]?.trim();
      const process = fields[1]?.trim();
      const notes = fields[2]?.trim();
      const phone = fields[3]?.trim();
      const rating = fields[5]?.trim() || '';

      if (!name) {
        console.log(`⚠️  라인 ${lineNumber}: 이름 없음 (건너뜀)`);
        skipCount++;
        continue;
      }

      // Insert into database
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO contractors (name, contact_person, phone, email, specialty, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            name.split('_')[0] || name, // company name from format "회사명_담당자"
            name.includes('_') ? name.split('_')[1] : '', // contact person
            phone || '',
            '', // email (not in CSV)
            process || '', // specialty = 공정
            notes || '' // notes
          ],
          (err) => {
            if (err) {
              console.error(`  ❌ 라인 ${lineNumber} 실패 (${name}):`, err.message);
              skipCount++;
            } else {
              importCount++;
              if (importCount <= 5 || importCount % 20 === 0) {
                console.log(`  ✅ ${importCount}. ${name} (${process})`);
              }
            }
            resolve();
          }
        );
      });
    }

    console.log('\n✨ Import 완료!');
    console.log(`📊 결과:`);
    console.log(`  - 성공: ${importCount}개`);
    console.log(`  - 실패/건너뜀: ${skipCount}개`);
    console.log(`  - 총 처리: ${lineNumber - 1}줄`);

    // Verify data
    db.get('SELECT COUNT(*) as count FROM contractors', (err, row) => {
      if (!err) {
        console.log(`\n💾 데이터베이스 총 협력업체: ${row.count}개`);
      }
    });

  } catch (error) {
    console.error('❌ Import 실패:', error);
  } finally {
    db.close();
    console.log('\n💾 데이터베이스 연결 종료');
  }
}

// Run import
importContractors().catch(console.error);
