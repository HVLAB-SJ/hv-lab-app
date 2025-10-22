const fs = require('fs');
const readline = require('readline');

const CSV_PATH = 'C:/Users/kim_s/Desktop/인테리어 협력업체 연락처 285ffc3229ec401f95cd665453ba86a6_all.csv';

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

    // Skip header
    if (lineNumber === 1) continue;

    const fields = line.split(',');
    if (fields.length < 4) continue;

    const name = fields[0]?.trim();
    const process = fields[1]?.trim();
    const notes = fields[2]?.trim();
    const phone = fields[3]?.trim();

    if (!name) continue;

    contractors.push({
      name: name.split('_')[0] || name,
      contact_person: name.includes('_') ? name.split('_')[1] : '',
      phone: phone || '',
      specialty: process || '',
      notes: notes || ''
    });
  }

  console.log('module.exports = ' + JSON.stringify(contractors, null, 2) + ';');
}

generateSeedData().catch(console.error);
