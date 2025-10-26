import mongoose, { Document, Schema } from 'mongoose';

export interface ISchedule extends Document {
  project: mongoose.Types.ObjectId;
  title: string;
  type: 'construction' | 'material' | 'inspection' | 'meeting' | 'other';
  phase: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  assignedTo: mongoose.Types.ObjectId[];
  assigneeNames?: string[];  // 담당자 이름 (문자열 배열)
  description?: string;
  location?: string;
  progress: number;
  dependencies?: mongoose.Types.ObjectId[];
  isCompleted: boolean;
  completedAt?: Date;
  priority: 'low' | 'medium' | 'high';
  asRequestId?: string;  // AS 요청 ID (AS 일정과 연결)
  time?: string;  // 시간 정보 (HH:mm 형식)
  reminders: Array<{
    type: 'email' | 'kakao' | 'push';
    time: Date;
    sent: boolean;
  }>;
  attachments: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  notes: Array<{
    content: string;
    author: mongoose.Types.ObjectId;
    createdAt: Date;
  }>;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleSchema = new Schema<ISchedule>({
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, '프로젝트를 선택해주세요']
  },
  title: {
    type: String,
    required: [true, '일정 제목을 입력해주세요'],
    trim: true
  },
  type: {
    type: String,
    enum: ['construction', 'material', 'inspection', 'meeting', 'other'],
    required: [true, '일정 유형을 선택해주세요']
  },
  phase: {
    type: String,
    required: [true, '공정 단계를 입력해주세요']
  },
  startDate: {
    type: Date,
    required: [true, '시작일을 입력해주세요']
  },
  endDate: {
    type: Date,
    required: [true, '종료일을 입력해주세요']
  },
  allDay: {
    type: Boolean,
    default: false
  },
  assignedTo: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  assigneeNames: [{
    type: String
  }],
  description: String,
  location: String,
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  dependencies: [{
    type: Schema.Types.ObjectId,
    ref: 'Schedule'
  }],
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  asRequestId: {
    type: String,
    index: true
  },
  time: {
    type: String,
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '올바른 시간 형식이 아닙니다 (HH:mm)']
  },
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'kakao', 'push']
    },
    time: Date,
    sent: {
      type: Boolean,
      default: false
    }
  }],
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  notes: [{
    content: String,
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
scheduleSchema.index({ project: 1, startDate: 1 });
scheduleSchema.index({ assignedTo: 1 });
scheduleSchema.index({ type: 1 });
scheduleSchema.index({ isCompleted: 1 });

// Virtual for duration
scheduleSchema.virtual('duration').get(function() {
  return Math.ceil((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24));
});

export default mongoose.model<ISchedule>('Schedule', scheduleSchema);