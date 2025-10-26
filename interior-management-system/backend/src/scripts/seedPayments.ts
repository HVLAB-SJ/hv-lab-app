import mongoose from 'mongoose';
import Payment from '../models/Payment.model';
import Project from '../models/Project.model';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function seedPayments() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing payments
    await Payment.deleteMany({});
    console.log('🗑️  Cleared existing payments');

    // Find or create test project
    let project = await Project.findOne({ name: '강남 아파트' });
    if (!project) {
      project = await Project.create({
        name: '강남 아파트',
        client: {
          name: '김철수',
          phone: '010-1234-5678',
          address: '서울 강남구'
        },
        location: {
          address: '서울 강남구 테헤란로 123'
        },
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        status: 'inProgress',
        budget: 50000000,
        manager: '000000000000000000000000',
        createdBy: '000000000000000000000000'
      });
      console.log('📁 Created test project');
    }

    // Create test payments with proper Korean encoding
    const payments = [
      {
        project: project._id,
        requestedBy: '김현장',
        purpose: '타일 자재 구매',
        process: '타일 시공',
        itemName: '타일',
        amount: 5000000,
        category: 'material',
        urgency: 'urgent',
        status: 'pending',
        bankInfo: {
          accountHolder: '(주)타일마트',
          bankName: '국민은행',
          accountNumber: '123-456-789012'
        },
        notes: '긴급 구매 필요',
        requestDate: new Date()
      },
      {
        project: project._id,
        requestedBy: '이대리',
        purpose: '인건비 지급',
        process: '목공 작업',
        itemName: '목수 인건비',
        amount: 3000000,
        category: 'labor',
        urgency: 'normal',
        status: 'pending',
        bankInfo: {
          accountHolder: '박목수',
          bankName: '신한은행',
          accountNumber: '987-654-321098'
        },
        notes: '월말 정산',
        requestDate: new Date()
      },
      {
        project: project._id,
        requestedBy: '최팀장',
        purpose: '장비 렌탈',
        process: '철거 작업',
        itemName: '굴삭기',
        amount: 1500000,
        category: 'equipment',
        urgency: 'normal',
        status: 'pending',
        bankInfo: {
          accountHolder: '대한렌탈',
          bankName: '우리은행',
          accountNumber: '111-222-333444'
        },
        notes: '3일간 렌탈',
        requestDate: new Date()
      }
    ];

    const insertedPayments = await Payment.insertMany(payments);
    console.log(`✅ Inserted ${insertedPayments.length} payments`);

    insertedPayments.forEach(payment => {
      console.log(`   - ${payment.purpose} (${payment.amount.toLocaleString()}원)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding payments:', error);
    process.exit(1);
  }
}

seedPayments();
