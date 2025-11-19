import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  project: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId | string;
  approvedBy?: mongoose.Types.ObjectId | string;
  processedBy?: mongoose.Types.ObjectId | string;
  amount: number;
  materialAmount?: number; // 자재비
  laborAmount?: number; // 인건비
  originalMaterialAmount?: number; // 공제 전 원래 자재비
  originalLaborAmount?: number; // 공제 전 원래 인건비
  applyTaxDeduction?: boolean; // 3.3% 세금공제 여부
  includesVAT?: boolean; // 부가세 포함 여부
  quickText?: string; // 자동으로 항목 채우기에 입력했던 원본 텍스트
  purpose: string;
  process?: string;
  itemName?: string;
  category: 'material' | 'labor' | 'equipment' | 'transport' | 'other';
  paymentMethod: 'bankTransfer' | 'cash' | 'card' | 'other';
  status: 'pending' | 'reviewing' | 'approved' | 'on-hold' | 'rejected' | 'completed';
  bankInfo?: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
  };
  receiptImages: string[];
  attachments: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  requestDate: Date;
  approvalDate?: Date;
  completionDate?: Date;
  rejectionReason?: string;
  notes?: string;
  urgency: 'normal' | 'urgent' | 'emergency';
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>({
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, '프로젝트를 선택해주세요']
  },
  requestedBy: {
    type: Schema.Types.Mixed,
    required: true
  },
  approvedBy: {
    type: Schema.Types.Mixed
  },
  processedBy: {
    type: Schema.Types.Mixed
  },
  amount: {
    type: Number,
    required: [true, '금액을 입력해주세요'],
    min: [0, '금액은 0보다 커야 합니다']
  },
  materialAmount: {
    type: Number,
    min: 0
  },
  laborAmount: {
    type: Number,
    min: 0
  },
  originalMaterialAmount: {
    type: Number,
    min: 0
  },
  originalLaborAmount: {
    type: Number,
    min: 0
  },
  applyTaxDeduction: {
    type: Boolean,
    default: false
  },
  includesVAT: {
    type: Boolean,
    default: false
  },
  quickText: {
    type: String,
    trim: true
  },
  purpose: {
    type: String,
    required: false,
    trim: true
  },
  process: {
    type: String,
    trim: true
  },
  itemName: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['material', 'labor', 'equipment', 'transport', 'other'],
    required: [true, '카테고리를 선택해주세요']
  },
  paymentMethod: {
    type: String,
    enum: ['bankTransfer', 'cash', 'card', 'other'],
    default: 'bankTransfer'
  },
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'approved', 'on-hold', 'rejected', 'completed'],
    default: 'pending'
  },
  bankInfo: {
    accountHolder: String,
    bankName: String,
    accountNumber: String
  },
  receiptImages: [String],
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  requestDate: {
    type: Date,
    default: Date.now
  },
  approvalDate: Date,
  completionDate: Date,
  rejectionReason: String,
  notes: String,
  urgency: {
    type: String,
    enum: ['normal', 'urgent', 'emergency'],
    default: 'normal'
  },
  transactionId: String
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ project: 1, status: 1 });
paymentSchema.index({ requestedBy: 1 });
paymentSchema.index({ status: 1, requestDate: -1 });
paymentSchema.index({ urgency: 1, status: 1 });

// Virtual for processing time
paymentSchema.virtual('processingTime').get(function() {
  if (this.completionDate && this.requestDate) {
    return Math.ceil((this.completionDate.getTime() - this.requestDate.getTime()) / (1000 * 60 * 60));
  }
  return null;
});

export default mongoose.model<IPayment>('Payment', paymentSchema);