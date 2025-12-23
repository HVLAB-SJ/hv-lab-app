/**
 * SQLite → Firestore 데이터 마이그레이션 스크립트 v2
 * REST API 사용
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const https = require('https');

// Firebase 설정
const PROJECT_ID = 'hv-lab-app';
const serviceAccount = require('./serviceAccountKey.json');

// JWT 토큰 생성을 위한 함수
const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signatureInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  return new Promise((resolve, reject) => {
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        resolve(parsed.access_token);
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function writeToFirestore(accessToken, collection, docId, data) {
  return new Promise((resolve, reject) => {
    // Convert data to Firestore format
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        fields[key] = { nullValue: null };
      } else if (typeof value === 'string') {
        fields[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          fields[key] = { integerValue: String(value) };
        } else {
          fields[key] = { doubleValue: value };
        }
      } else if (typeof value === 'boolean') {
        fields[key] = { booleanValue: value };
      } else if (Array.isArray(value)) {
        fields[key] = {
          arrayValue: {
            values: value.map(v => {
              if (typeof v === 'string') return { stringValue: v };
              if (typeof v === 'number') return { integerValue: String(v) };
              if (typeof v === 'object') return { mapValue: { fields: {} } };
              return { stringValue: String(v) };
            })
          }
        };
      } else if (typeof value === 'object') {
        fields[key] = { mapValue: { fields: {} } };
      }
    }

    const body = JSON.stringify({ fields });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// SQLite 데이터베이스 연결
const dbPath = path.join(__dirname, 'database.db');
const sqliteDb = new sqlite3.Database(dbPath);

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function main() {
  console.log('🚀 SQLite → Firestore 마이그레이션 시작 (REST API)\n');

  try {
    console.log('🔑 액세스 토큰 발급 중...');
    const accessToken = await getAccessToken();
    console.log('✅ 토큰 발급 완료\n');

    // 사용자 마이그레이션
    console.log('👤 사용자 마이그레이션 시작...');
    const users = await dbAll('SELECT * FROM users');
    for (const user of users) {
      await writeToFirestore(accessToken, 'users', String(user.id), {
        username: user.username || '',
        password: user.password || '',
        name: user.name || '',
        role: user.role || 'user',
        department: user.department || '',
        phone: user.phone || '',
        email: user.email || ''
      });
      console.log(`  ✓ ${user.username}`);
    }
    console.log(`✅ 사용자 ${users.length}명 완료\n`);

    // 프로젝트 마이그레이션
    console.log('📁 프로젝트 마이그레이션 시작...');
    const projects = await dbAll('SELECT * FROM projects');
    for (const project of projects) {
      await writeToFirestore(accessToken, 'projects', String(project.id), {
        name: project.name || '',
        client: project.client || '',
        address: project.address || '',
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        status: project.status || 'planning',
        color: project.color || '#4A90E2',
        description: project.description || '',
        manager_id: project.manager_id ? String(project.manager_id) : '',
        manager_name: project.manager_name || '',
        entrance_password: project.entrance_password || '',
        site_password: project.site_password || ''
      });
      console.log(`  ✓ ${project.name}`);
    }
    console.log(`✅ 프로젝트 ${projects.length}개 완료\n`);

    // 일정 마이그레이션
    console.log('📅 일정 마이그레이션 시작...');
    const schedules = await dbAll('SELECT * FROM schedules');
    for (const schedule of schedules) {
      await writeToFirestore(accessToken, 'schedules', String(schedule.id), {
        project_id: schedule.project_id ? String(schedule.project_id) : '',
        project: schedule.project || '',
        title: schedule.title || '',
        description: schedule.description || '',
        start_date: schedule.start_date || '',
        end_date: schedule.end_date || '',
        status: schedule.status || 'pending',
        progress: schedule.progress || 0,
        assignee: schedule.assignee || '',
        priority: schedule.priority || 'medium',
        color: schedule.color || ''
      });
      console.log(`  ✓ ${schedule.title}`);
    }
    console.log(`✅ 일정 ${schedules.length}개 완료\n`);

    // 결제 마이그레이션
    console.log('💰 결제 마이그레이션 시작...');
    const payments = await dbAll('SELECT * FROM payments');
    for (const payment of payments) {
      await writeToFirestore(accessToken, 'payments', String(payment.id), {
        project_id: payment.project_id ? String(payment.project_id) : '',
        project: payment.project || '',
        amount: payment.amount || 0,
        description: payment.description || '',
        status: payment.status || 'pending',
        payment_date: payment.payment_date || '',
        due_date: payment.due_date || '',
        requester: payment.requester || '',
        approver: payment.approver || ''
      });
      console.log(`  ✓ ${payment.description || payment.id}`);
    }
    console.log(`✅ 결제 ${payments.length}개 완료\n`);

    console.log('🎉 모든 데이터 마이그레이션 완료!');
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    sqliteDb.close();
  }
}

main();
