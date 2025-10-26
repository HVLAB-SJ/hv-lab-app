import mongoose from 'mongoose';
import Project from '../models/Project.model';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const projects = [
  {
    name: '강남 아파트',
    client: '김철수',
    location: '서울 강남구',
    status: 'in-progress',
    progress: 65,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-03-31'),
    budget: 50000000,
    spent: 32500000,
    manager: '상준',
    team: ['신애', '재천'],
    description: '30평 아파트 전체 리모델링'
  },
  {
    name: '서초 오피스',
    client: '㈜테크컴퍼니',
    location: '서울 서초구',
    status: 'in-progress',
    progress: 40,
    startDate: new Date('2025-01-15'),
    endDate: new Date('2025-04-15'),
    budget: 80000000,
    spent: 32000000,
    manager: '민기',
    team: ['재성', '재현'],
    description: '오피스 인테리어 및 가구 설치'
  },
  {
    name: '판교 카페',
    client: '이영희',
    location: '경기 성남시',
    status: 'planning',
    progress: 10,
    startDate: new Date('2025-02-01'),
    endDate: new Date('2025-05-01'),
    budget: 35000000,
    spent: 3500000,
    manager: '재천',
    team: ['신애'],
    description: '카페 신규 오픈 인테리어'
  }
];

async function seedProjects() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing projects
    await Project.deleteMany({});
    console.log('🗑️  Cleared existing projects');

    // Insert new projects
    const insertedProjects = await Project.insertMany(projects);
    console.log(`✅ Inserted ${insertedProjects.length} projects`);

    insertedProjects.forEach(project => {
      console.log(`   - ${project.name} (ID: ${project._id})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding projects:', error);
    process.exit(1);
  }
}

seedProjects();
