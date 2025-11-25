import mongoose, { Document, Schema } from 'mongoose';

export interface IMarker {
  id: string;
  x: number;
  y: number;
  roomId: string | null;
  roomX?: number;
  roomY?: number;
  type: string;
  label: string;
  details?: string;
}

export interface IRoom {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IDrawing extends Document {
  projectId: mongoose.Types.ObjectId;
  type: string;
  imageUrl: string;
  markers: IMarker[];
  rooms: IRoom[];
  // 네이버도면 전용 필드
  naverTypeSqm?: string;
  naverTypePyeong?: string;
  naverArea?: string;
  createdBy: mongoose.Types.ObjectId;
  lastModifiedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const markerSchema = new Schema<IMarker>({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  roomId: { type: String, default: null },
  roomX: { type: Number },
  roomY: { type: Number },
  type: { type: String, required: true },
  label: { type: String, default: '' },
  details: { type: String }
}, { _id: false });

const roomSchema = new Schema<IRoom>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true }
}, { _id: false });

const drawingSchema = new Schema<IDrawing>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, '프로젝트 ID가 필요합니다']
  },
  type: {
    type: String,
    required: [true, '도면 종류가 필요합니다'],
    enum: [
      '네이버도면',
      '건축도면',
      '평면도',
      '3D도면',
      '철거도면',
      '전기도면',
      '설비도면',
      '목공도면',
      '타일도면',
      '금속도면',
      '가구도면',
      '세라믹도면',
      '디테일도면',
      '천장도면'
    ]
  },
  imageUrl: {
    type: String,
    required: [true, '도면 이미지가 필요합니다']
  },
  markers: [markerSchema],
  rooms: [roomSchema],
  // 네이버도면 전용 필드
  naverTypeSqm: { type: String },
  naverTypePyeong: { type: String },
  naverArea: { type: String },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// 복합 인덱스: 프로젝트 + 도면 종류로 유니크
drawingSchema.index({ projectId: 1, type: 1 }, { unique: true });

export default mongoose.model<IDrawing>('Drawing', drawingSchema);
