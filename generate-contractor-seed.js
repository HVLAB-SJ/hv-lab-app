const fs = require('fs');
const readline = require('readline');

const CSV_PATH = 'C:/Users/kim_s/Desktop/인테리어 협력업체 연락처 285ffc3229ec401f95cd665453ba86a6_all.csv';

// Simple CSV parser that handles quoted fields
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());

  return fields;
}

async function generateSeedData() {
  const fileStream = fs.createReadStream(CSV_PATH, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  const contractors = [];

  for await (const line of rl) {
    lineNumber++;

    // Skip header and BOM
    if (lineNumber === 1) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 4) continue;

    const name = fields[0]?.trim();
    const process = fields[1]?.trim();
    const notes = fields[2]?.trim();
    const phone = fields[3]?.trim();
    const rank = fields[5]?.trim() || ''; // 평가 컬럼 (1순위, 2순위 등)

    if (!name) continue;

    contractors.push({
      name: name.split('_')[0] || name,
      contact_person: name.includes('_') ? name.split('_')[1] : '',
      phone: phone || '',
      specialty: process || '',
      notes: notes || '',
      rank: rank
    });
  }

  console.log('module.exports = ' + JSON.stringify(contractors, null, 2) + ';');
}

generateSeedData().catch(console.error);
