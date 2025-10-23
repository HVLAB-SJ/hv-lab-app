const fs = require('fs');
const path = require('path');

const jsonPath = 'C:/Users/kim_s/Desktop/HV LAB 정산 백업/all_contractors.json';
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log('📊 JSON 파일 협력업체 분석\n');
console.log(`총 개수: ${data.length}개\n`);

console.log('샘플 데이터 (처음 10개):');
data.slice(0, 10).forEach((c, i) => {
  console.log(`${i + 1}. ${c.name} - ${c.process} - ${c.person_name || '(담당자 없음)'} - 총액: ${c.total_amount?.toLocaleString() || 0}원`);
});

console.log('\n\n공정별 분포:');
const processCounts = {};
data.forEach(c => {
  processCounts[c.process] = (processCounts[c.process] || 0) + 1;
});
Object.entries(processCounts).sort((a, b) => b[1] - a[1]).forEach(([process, count]) => {
  console.log(`  ${process}: ${count}개`);
});
