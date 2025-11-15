const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

async function migrateData() {
  return new Promise((resolve, reject) => {
    // First, find the project ID for "대림아크로텔_엄상진님"
    db.get(
      "SELECT id, name FROM projects WHERE name LIKE '%대림%' OR name LIKE '%엄상진%'",
      [],
      (err, project) => {
        if (err) {
          console.error('프로젝트 조회 실패:', err);
          reject(err);
          return;
        }

        if (!project) {
          console.log('대림아크로텔_엄상진님 프로젝트를 찾을 수 없습니다.');
          console.log('\n모든 프로젝트 목록:');
          db.all('SELECT id, name FROM projects ORDER BY created_at DESC', [], (err, projects) => {
            if (err) {
              console.error('프로젝트 목록 조회 실패:', err);
            } else {
              projects.forEach(p => {
                console.log(`  ID: ${p.id}, Name: ${p.name}`);
              });
            }
            resolve();
          });
          return;
        }

        console.log(`\n찾은 프로젝트: ${project.name} (ID: ${project.id})`);

        // Update all finish_check_spaces to this project
        db.run(
          'UPDATE finish_check_spaces SET project_id = ? WHERE project_id IS NULL',
          [project.id],
          function(err) {
            if (err) {
              console.error('마감체크 공간 업데이트 실패:', err);
              reject(err);
              return;
            }

            console.log(`\n✓ ${this.changes}개의 공간이 "${project.name}" 프로젝트로 이동되었습니다.`);

            // Verify the update
            db.all(
              'SELECT id, name, project_id FROM finish_check_spaces',
              [],
              (err, spaces) => {
                if (err) {
                  console.error('검증 실패:', err);
                } else {
                  console.log('\n모든 마감체크 공간:');
                  spaces.forEach(s => {
                    console.log(`  ID: ${s.id}, Name: ${s.name}, Project ID: ${s.project_id}`);
                  });
                }
                resolve();
              }
            );
          }
        );
      }
    );
  });
}

migrateData()
  .then(() => {
    console.log('\n마이그레이션 완료!');
    db.close();
  })
  .catch((err) => {
    console.error('\n마이그레이션 실패:', err);
    db.close();
    process.exit(1);
  });
