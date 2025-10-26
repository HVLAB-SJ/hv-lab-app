import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
  name: string;
  client: {
    name: string;
    phone: string;
    email?: string;
    address: string;
  };
  location: {
    address: string;
    detailAddress?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  startDate: Date;
  endDate: Date;
  status: 'planning' | 'inProgress' | 'completed' | 'onHold';
  budget: number;
  actualCost: number;
  manager?: mongoose.Types.ObjectId;
  fieldManagers: mongoose.Types.ObjectId[];
  workers: mongoose.Types.ObjectId[];
  colorCode: string;
  progress: number;
  description?: string;
  attachments: Array<{
    name: string;
    url: string;
    type: string;
    uploadedAt: Date;
  }>;
  meetingNotes?: Array<{
    id: string;
    content: string;
    date: Date;
  }>;
  customerRequests?: Array<{
    id: string;
    content: string;
    completed: boolean;
    createdAt: Date;
  }>;
  entrancePassword?: string;
  sitePassword?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>({
  name: {
    type: String,
    required: [true, '프로젝트명을 입력해주세요'],
    trim: true
  },
  client: {
    name: {
      type: String
    },
    phone: {
      type: String
    },
    email: String,
    address: {
      type: String
    }
  },
  location: {
    address: {
      type: String,
      required: [true, '현장 주소를 입력해주세요']
    },
    detailAddress: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['planning', 'inProgress', 'completed', 'onHold'],
    default: 'planning'
  },
  budget: {
    type: Number,
    required: [true, '예산을 입력해주세요']
  },
  actualCost: {
    type: Number,
    default: 0
  },
  manager: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  fieldManagers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  workers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  colorCode: {
    type: String,
    default: '#9CA3AF'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  description: String,
  attachments: [{
    name: String,
    url: String,
    type: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  meetingNotes: [{
    id: String,
    content: String,
    date: Date
  }],
  customerRequests: [{
    id: String,
    content: String,
    completed: Boolean,
    createdAt: Date
  }],
  entrancePassword: String,
  sitePassword: String,
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
projectSchema.index({ status: 1, startDate: 1 });
projectSchema.index({ manager: 1 });
projectSchema.index({ fieldManagers: 1 });

export default mongoose.model<IProject>('Project', projectSchema);