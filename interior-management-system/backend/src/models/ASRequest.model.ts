import mongoose, { Document, Schema } from 'mongoose';

export interface IASRequest extends Document {
  project: string;
  client: string;
  requestDate?: Date;
  siteAddress: string;
  entrancePassword?: string;
  description?: string;
  scheduledVisitDate?: Date;
  scheduledVisitTime?: string;  // 방문 시간 (HH:mm 형식)
  assignedTo?: string[];
  completionDate?: Date;
  notes?: string;
  status?: 'pending' | 'completed' | 'revisit'; // AS 상태
  createdAt: Date;
  updatedAt: Date;
}

const asRequestSchema = new Schema<IASRequest>({
  project: {
    type: String,
    required: [true, '프로젝트명을 입력해주세요'],
    trim: true
  },
  client: {
    type: String,
    required: [true, '고객명을 입력해주세요'],
    trim: true
  },
  requestDate: {
    type: Date
  },
  siteAddress: {
    type: String,
    required: [true, '현장주소를 입력해주세요'],
    trim: true
  },
  entrancePassword: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  scheduledVisitDate: {
    type: Date
  },
  scheduledVisitTime: {
    type: String,
    trim: true
  },
  assignedTo: {
    type: [String],
    default: []
  },
  completionDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'revisit'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Indexes
asRequestSchema.index({ project: 1 });
asRequestSchema.index({ requestDate: -1 });

export default mongoose.model<IASRequest>('ASRequest', asRequestSchema);
