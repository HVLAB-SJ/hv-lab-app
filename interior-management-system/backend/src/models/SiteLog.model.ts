import mongoose, { Document, Schema } from 'mongoose';

export interface ISiteLog extends Document {
  project: string;
  date: Date;
  images: string[];
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const siteLogSchema = new Schema<ISiteLog>({
  project: {
    type: String,
    required: [true, '프로젝트를 선택해주세요'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, '날짜를 선택해주세요']
  },
  images: {
    type: [String],
    default: []
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: String,
    required: [true, '작성자를 입력해주세요'],
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
siteLogSchema.index({ project: 1, date: -1 });
siteLogSchema.index({ date: -1 });

export default mongoose.model<ISiteLog>('SiteLog', siteLogSchema);
