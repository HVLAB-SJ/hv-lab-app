const { db } = require('./server/config/database');
const fs = require('fs');
const path = require('path');

console.log('🧹 Starting contractor data cleanup...\n');

// Load backup data for rankings
const backupPath = path.join(__dirname, 'frontend-source', 'interior-management-system', 'backend', 'backups', 'backup-2025-10-13T10-26-56-694Z.json');
const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const backupContractors = backupData.collections.contractors || [];

console.log(`📂 Loaded ${backupContractors.length} contractors from backup\n`);

// Function to extract position from name
function extractPosition(name) {
  const positions = [
    '대표이사', '부사장', '전무', '상무', '이사', '실장', '부장', '차장', '과장', '대리',
    '주임', '사원', '팀장', '소장', '대표', '사장', '회장', '반장', '현장', '본부장',
    '팀원', '파트장', '조장', '감독', '기사', '수석', '책임'
  ];

  // Remove "님" suffix first
  const cleanName = name.replace(/님$/g, '').trim();

  for (const position of positions) {
    if (cleanName.endsWith(position)) {
      const nameOnly = cleanName.substring(0, cleanName.length - position.length).trim();
      return { name: nameOnly, position: position };
    }
  }

  return { name: cleanName, position: null };
}

// Function to extract company name from name field (e.g., "타일팀(아이러브타일)" -> "아이러브타일")
function extractCompanyName(name) {
  const match = name.match(/\(([^)]+)\)/);
  return match ? match[1] : name;
}

// Function to find ranking from backup
function findRankingFromBackup(name, specialty) {
  // Extract company name from current name (e.g., "타일팀(아이러브타일)" -> "아이러브타일")
  const companyName = extractCompanyName(name);

  // Try to match by companyName and specialty/process
  for (const contractor of backupContractors) {
    if (contractor.companyName && contractor.process) {
      // Match if companyName contains the extracted name or vice versa
      const companyMatch = contractor.companyName.includes(companyName) || companyName.includes(contractor.companyName);
      const processMatch = contractor.process === specialty;

      if (companyMatch && processMatch) {
        return contractor.rank || null;
      }
    }
  }

  // Try to match by companyName only if specialty match fails
  for (const contractor of backupContractors) {
    if (contractor.companyName) {
      if (contractor.companyName.includes(companyName) || companyName.includes(contractor.companyName)) {
        return contractor.rank || null;
      }
    }
  }

  return null;
}

// Get all contractors
db.all('SELECT * FROM contractors', [], (err, contractors) => {
  if (err) {
    console.error('❌ Error loading contractors:', err);
    db.close();
    return;
  }

  console.log(`📋 Processing ${contractors.length} contractors...\n`);

  let updated = 0;
  let processed = 0;

  contractors.forEach((contractor, index) => {
    const { name, position: currentPosition, specialty, notes } = contractor;

    // Extract position from name
    const { name: cleanName, position: extractedPosition } = extractPosition(name);

    // Determine final position (prefer existing position if not empty)
    let finalPosition = currentPosition || extractedPosition || '';

    // Remove double quotes from specialty and notes
    const cleanSpecialty = (specialty || '').replace(/^"|"$/g, '').replace(/"/g, '');
    const cleanNotes = (notes || '').replace(/^"|"$/g, '').replace(/"/g, '');

    // Find ranking from backup (use original name before position extraction to get company name)
    const ranking = findRankingFromBackup(name, cleanSpecialty);

    // Check if any changes are needed
    const needsUpdate =
      name !== cleanName ||
      finalPosition !== currentPosition ||
      cleanSpecialty !== specialty ||
      cleanNotes !== notes ||
      (ranking && ranking !== contractor.rank);

    if (needsUpdate) {
      const updates = [];
      const values = [];

      if (name !== cleanName) {
        updates.push('name = ?');
        values.push(cleanName);
        console.log(`  ✏️  Name: "${name}" → "${cleanName}"`);
      }

      if (finalPosition !== currentPosition) {
        updates.push('position = ?');
        values.push(finalPosition);
        console.log(`  👔 Position: "${currentPosition || 'null'}" → "${finalPosition}"`);
      }

      if (cleanSpecialty !== specialty) {
        updates.push('specialty = ?');
        values.push(cleanSpecialty);
        console.log(`  🔧 Specialty: "${specialty}" → "${cleanSpecialty}"`);
      }

      if (cleanNotes !== notes) {
        updates.push('notes = ?');
        values.push(cleanNotes);
        console.log(`  📝 Notes: "${notes}" → "${cleanNotes}"`);
      }

      if (ranking && ranking !== contractor.rank) {
        updates.push('rank = ?');
        values.push(ranking);
        console.log(`  ⭐ Rank: "${contractor.rank || 'null'}" → "${ranking}"`);
      }

      if (updates.length > 0) {
        values.push(contractor.id);
        const query = `UPDATE contractors SET ${updates.join(', ')} WHERE id = ?`;

        db.run(query, values, function(err) {
          if (err) {
            console.error(`❌ Error updating contractor ${contractor.id}:`, err);
          } else {
            updated++;
          }

          processed++;

          if (processed === contractors.length) {
            console.log(`\n✅ Cleanup complete!`);
            console.log(`   Updated: ${updated} contractors`);
            console.log(`   Unchanged: ${contractors.length - updated} contractors`);
            db.close();
          }
        });
      } else {
        processed++;
        if (processed === contractors.length) {
          console.log(`\n✅ Cleanup complete!`);
          console.log(`   Updated: ${updated} contractors`);
          console.log(`   Unchanged: ${contractors.length - updated} contractors`);
          db.close();
        }
      }
    } else {
      processed++;
      if (processed === contractors.length) {
        console.log(`\n✅ Cleanup complete!`);
        console.log(`   Updated: ${updated} contractors`);
        console.log(`   Unchanged: ${contractors.length - updated} contractors`);
        db.close();
      }
    }
  });

  if (contractors.length === 0) {
    console.log('⚠️  No contractors found');
    db.close();
  }
});
