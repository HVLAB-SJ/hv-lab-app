import mongoose, { Document, Schema } from 'mongoose';

export interface IExecutionRecord extends Document {
  projectId: mongoose.Types.ObjectId;
  projectName: string;
  author: string;
  date: Date;
  process: string;
  itemName: string;
  materialCost: number;
  laborCost: number;
  vatAmount: number;
  totalAmount: number;
  notes: string;
  paymentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const executionRecordSchema = new Schema<IExecutionRecord>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  projectName: {
    type: String,
    required: [true, '프로젝트 이름이 필요합니다']
  },
  author: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    required: [true, '날짜가 필요합니다']
  },
  process: {
    type: String,
    default: ''
  },
  itemName: {
    type: String,
    required: [true, '항목명이 필요합니다']
  },
  materialCost: {
    type: Number,
    default: 0
  },
  laborCost: {
    type: Number,
    default: 0
  },
  vatAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  },
  paymentId: {
    type: Schema.Types.ObjectId,
    ref: 'Payment'
  }
}, {
  timestamps: true
});

// 인덱스
executionRecordSchema.index({ projectName: 1 });
executionRecordSchema.index({ date: -1 });
executionRecordSchema.index({ process: 1 });

export default mongoose.model<IExecutionRecord>('ExecutionRecord', executionRecordSchema);
