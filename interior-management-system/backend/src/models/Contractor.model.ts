import mongoose, { Document, Schema } from 'mongoose';

export interface IContractor extends Document {
  rank?: string;
  companyName?: string;
  name: string;
  process: string;
  contact?: string;
  accountNumber: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contractorSchema = new Schema<IContractor>({
  rank: {
    type: String,
    trim: true
  },
  companyName: {
    type: String,
    trim: true
  },
  name: {
    type: String,
    required: [true, '이름을 입력해주세요'],
    trim: true
  },
  process: {
    type: String,
    required: [true, '공정을 입력해주세요'],
    trim: true
  },
  contact: {
    type: String,
    trim: true
  },
  accountNumber: {
    type: String,
    default: '',
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
contractorSchema.index({ name: 1 });
contractorSchema.index({ process: 1 });

export default mongoose.model<IContractor>('Contractor', contractorSchema);
