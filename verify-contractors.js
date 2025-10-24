const { db } = require('./server/config/database');

console.log('📊 Verifying contractor data cleanup...\n');

db.all('SELECT id, name, position, specialty, rank FROM contractors LIMIT 20', [], (err, rows) => {
  if (err) {
    console.error('❌ Error:', err);
    db.close();
    return;
  }

  console.log('Sample contractors after cleanup:\n');
  rows.forEach(r => {
    console.log(`[${r.rank || '-'}] ${r.name}`);
    console.log(`   Position: ${r.position || '(없음)'}`);
    console.log(`   Specialty: ${r.specialty}`);
    console.log('');
  });

  // Get statistics
  db.all(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN rank IS NOT NULL THEN 1 ELSE 0 END) as with_rank,
      SUM(CASE WHEN rank IS NULL THEN 1 ELSE 0 END) as without_rank
    FROM contractors
  `, [], (err, stats) => {
    if (err) {
      console.error('❌ Error getting stats:', err);
    } else {
      console.log('📈 Statistics:');
      console.log(`   Total contractors: ${stats[0].total}`);
      console.log(`   With ranking: ${stats[0].with_rank}`);
      console.log(`   Without ranking: ${stats[0].without_rank}`);
    }
    db.close();
  });
});
