import mongoose, { Document, Schema } from 'mongoose';

export interface IConstructionPayment extends Document {
  project: string;
  client: string;
  totalAmount: number;
  vatType: 'percentage' | 'amount';
  vatPercentage: number;
  vatAmount: number;
  payments: Array<{
    types: ('계약금' | '착수금' | '중도금' | '잔금' | '추가금')[];
    amount: number;
    date: Date;
    method: string;
    notes?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const constructionPaymentSchema = new Schema<IConstructionPayment>({
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
  totalAmount: {
    type: Number,
    required: [true, '총 공사금액을 입력해주세요'],
    min: 0
  },
  vatType: {
    type: String,
    enum: ['percentage', 'amount'],
    default: 'percentage'
  },
  vatPercentage: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  vatAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  payments: [{
    types: {
      type: [String],
      enum: ['계약금', '착수금', '중도금', '잔금', '추가금'],
      default: []
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: Date,
      required: true
    },
    method: {
      type: String,
      required: true,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    }
  }]
}, {
  timestamps: true
});

// Indexes
constructionPaymentSchema.index({ project: 1 });
constructionPaymentSchema.index({ client: 1 });

export default mongoose.model<IConstructionPayment>('ConstructionPayment', constructionPaymentSchema);
