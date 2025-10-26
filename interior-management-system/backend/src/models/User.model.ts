import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  username: string;
  name: string;
  email?: string;
  password: string;
  role: 'admin' | 'manager' | 'fieldManager' | 'worker';
  phone?: string;
  department?: string;
  position?: string;
  avatar?: string;
  isActive: boolean;
  kakaoId?: string;
  notificationSettings: {
    email: boolean;
    kakao: boolean;
    push: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  username: {
    type: String,
    required: [true, '사용자명을 입력해주세요'],
    unique: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    required: [true, '이름을 입력해주세요'],
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, '비밀번호를 입력해주세요'],
    minlength: 4,
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'fieldManager', 'worker'],
    default: 'worker'
  },
  phone: String,
  department: String,
  position: String,
  avatar: String,
  isActive: {
    type: Boolean,
    default: true
  },
  kakaoId: String,
  notificationSettings: {
    email: { type: Boolean, default: true },
    kakao: { type: Boolean, default: true },
    push: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  return await bcrypt.compare(password, this.password);
};

export default mongoose.model<IUser>('User', userSchema);