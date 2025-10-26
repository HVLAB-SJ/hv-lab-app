import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkRequest extends Document {
  project: string;
  requestType: string; // 목공도면, 전기도면, 설비도면, 3D모델링, 기타
  description: string;
  requestDate: Date;
  dueDate: Date;
  requestedBy: string; // 요청자
  assignedTo: string; // 담당자
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  completedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkRequestSchema = new Schema<IWorkRequest>(
  {
    project: {
      type: String,
      required: true,
      trim: true
    },
    requestType: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: false,
      default: '',
      trim: true
    },
    requestDate: {
      type: Date,
      required: true
    },
    dueDate: {
      type: Date,
      required: true
    },
    requestedBy: {
      type: String,
      required: true,
      trim: true
    },
    assignedTo: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    notes: {
      type: String,
      trim: true
    },
    completedDate: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model<IWorkRequest>('WorkRequest', WorkRequestSchema);
