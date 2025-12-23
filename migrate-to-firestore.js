/**
 * SQLite → Firestore 데이터 마이그레이션 스크립트
 *
 * 사용법: node migrate-to-firestore.js
 */

const admin = require('firebase-admin');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Firebase Admin SDK 초기화 (서비스 계정 키 필요)
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

// SQLite 데이터베이스 연결
const dbPath = path.join(__dirname, 'database.db');
const sqliteDb = new sqlite3.Database(dbPath);

// Promise wrapper for SQLite
const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function migrateUsers() {
  console.log('👤 사용자 마이그레이션 시작...');

  const users = await dbAll('SELECT * FROM users');

  for (const user of users) {
    await firestore.collection('users').doc(String(user.id)).set({
      username: user.username,
      password: user.password, // 이미 해시된 비밀번호
      name: user.name,
      role: user.role,
      department: user.department || null,
      phone: user.phone || null,
      email: user.email || null,
      created_at: user.created_at ? new Date(user.created_at) : admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  ✓ 사용자: ${user.username}`);
  }

  console.log(`✅ 사용자 ${users.length}명 마이그레이션 완료`);
}

async function migrateProjects() {
  console.log('📁 프로젝트 마이그레이션 시작...');

  const projects = await dbAll('SELECT * FROM projects');

  for (const project of projects) {
    await firestore.collection('projects').doc(String(project.id)).set({
      name: project.name,
      client: project.client || null,
      address: project.address || null,
      start_date: project.start_date || null,
      end_date: project.end_date || null,
      status: project.status || 'planning',
      color: project.color || '#4A90E2',
      description: project.description || '',
      manager_id: project.manager_id ? String(project.manager_id) : null,
      manager_name: project.manager_name || null,
      meeting_notes: project.meeting_notes ? JSON.parse(project.meeting_notes) : [],
      customer_requests: project.customer_requests ? JSON.parse(project.customer_requests) : [],
      entrance_password: project.entrance_password || '',
      site_password: project.site_password || '',
      created_at: project.created_at ? new Date(project.created_at) : admin.firestore.FieldValue.serverTimestamp(),
      updated_at: project.updated_at ? new Date(project.updated_at) : admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  ✓ 프로젝트: ${project.name}`);
  }

  console.log(`✅ 프로젝트 ${projects.length}개 마이그레이션 완료`);
}

async function migrateSchedules() {
  console.log('📅 일정 마이그레이션 시작...');

  const schedules = await dbAll('SELECT * FROM schedules');

  for (const schedule of schedules) {
    await firestore.collection('schedules').doc(String(schedule.id)).set({
      project_id: schedule.project_id ? String(schedule.project_id) : null,
      project: schedule.project || null,
      title: schedule.title,
      description: schedule.description || '',
      start_date: schedule.start_date || null,
      end_date: schedule.end_date || null,
      status: schedule.status || 'pending',
      progress: schedule.progress || 0,
      assignee: schedule.assignee || null,
      priority: schedule.priority || 'medium',
      color: schedule.color || null,
      created_at: schedule.created_at ? new Date(schedule.created_at) : admin.firestore.FieldValue.serverTimestamp(),
      updated_at: schedule.updated_at ? new Date(schedule.updated_at) : admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  ✓ 일정: ${schedule.title}`);
  }

  console.log(`✅ 일정 ${schedules.length}개 마이그레이션 완료`);
}

async function migratePayments() {
  console.log('💰 결제 마이그레이션 시작...');

  const payments = await dbAll('SELECT * FROM payments');

  for (const payment of payments) {
    await firestore.collection('payments').doc(String(payment.id)).set({
      project_id: payment.project_id ? String(payment.project_id) : null,
      project: payment.project || null,
      amount: payment.amount || 0,
      description: payment.description || '',
      status: payment.status || 'pending',
      payment_date: payment.payment_date || null,
      due_date: payment.due_date || null,
      requester: payment.requester || null,
      approver: payment.approver || null,
      created_at: payment.created_at ? new Date(payment.created_at) : admin.firestore.FieldValue.serverTimestamp(),
      updated_at: payment.updated_at ? new Date(payment.updated_at) : admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  ✓ 결제: ${payment.description || payment.id}`);
  }

  console.log(`✅ 결제 ${payments.length}개 마이그레이션 완료`);
}

async function main() {
  console.log('🚀 SQLite → Firestore 마이그레이션 시작\n');
  console.log(`📂 SQLite DB: ${dbPath}\n`);

  try {
    await migrateUsers();
    console.log('');

    await migrateProjects();
    console.log('');

    await migrateSchedules();
    console.log('');

    await migratePayments();
    console.log('');

    console.log('🎉 모든 데이터 마이그레이션 완료!');
  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
  } finally {
    sqliteDb.close();
    process.exit(0);
  }
}

main();
