const { initDatabase } = require('./server/config/database');

console.log('Initializing database...');
initDatabase();

// Wait for database initialization to complete
setTimeout(() => {
  console.log('Database initialization complete!');
  process.exit(0);
}, 3000);
