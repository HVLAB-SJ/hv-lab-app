const { db } = require('./server/config/database');

console.log('🔄 Starting work_requests table migration...');

// Function to check if column exists
function columnExists(tableName, columnName, callback) {
  db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
    if (err) {
      callback(err, false);
      return;
    }
    const exists = columns.some(col => col.name === columnName);
    callback(null, exists);
  });
}

// Add columns one by one
function addColumn(columnName, columnType, callback) {
  columnExists('work_requests', columnName, (err, exists) => {
    if (err) {
      console.error(`❌ Error checking ${columnName}:`, err);
      callback(err);
      return;
    }

    if (exists) {
      console.log(`✅ Column '${columnName}' already exists`);
      callback(null);
      return;
    }

    db.run(`ALTER TABLE work_requests ADD COLUMN ${columnName} ${columnType}`, (err) => {
      if (err) {
        console.error(`❌ Error adding ${columnName}:`, err);
        callback(err);
        return;
      }
      console.log(`✅ Added column '${columnName}' (${columnType})`);
      callback(null);
    });
  });
}

// Add all required columns
const columnsToAdd = [
  { name: 'project', type: 'TEXT' },
  { name: 'request_date', type: 'DATE' },
  { name: 'request_type', type: 'TEXT' },
  { name: 'requested_by', type: 'TEXT' }
];

let currentIndex = 0;

function addNextColumn() {
  if (currentIndex >= columnsToAdd.length) {
    // All columns added, verify the schema
    db.all('PRAGMA table_info(work_requests)', (err, columns) => {
      if (err) {
        console.error('❌ Error reading final schema:', err);
        process.exit(1);
      }

      console.log('\n📋 Final work_requests table schema:');
      columns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}`);
      });

      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    });
    return;
  }

  const column = columnsToAdd[currentIndex];
  addColumn(column.name, column.type, (err) => {
    if (err) {
      console.error('❌ Migration failed');
      process.exit(1);
    }
    currentIndex++;
    addNextColumn();
  });
}

// Start migration
addNextColumn();
