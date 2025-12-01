import { Request, Response } from 'express';
import Drawing from '../models/Drawing.model';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Railway Volume 또는 로컬 업로드 디렉토리 설정
// Railway Volume 마운트 경로: /data (환경변수 RAILWAY_VOLUME_MOUNT_PATH)
const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || '';
const uploadDir = volumePath
  ? path.join(volumePath, 'drawings')  // Railway Volume 사용
  : path.join(__dirname, '../../uploads/drawings');  // 로컬 개발용

console.log('📁 도면 업로드 디렉토리:', uploadDir);

// 업로드 디렉토리가 없으면 생성
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✅ 업로드 디렉토리 생성됨');
}

// Volume 경로 내보내기 (index.ts에서 사용)
export const getUploadDir = () => uploadDir;
export const isUsingVolume = () => !!volumePath;

// Multer 설정
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `drawing-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('지원하지 않는 이미지 형식입니다.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

// 이미지 업로드
export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '이미지 파일이 필요합니다' });
      return;
    }

    // 상대 경로로 URL 생성
    const imageUrl = `/uploads/drawings/${req.file.filename}`;

    console.log('✅ 도면 이미지 업로드 완료:', imageUrl);
    res.status(200).json({ imageUrl });
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    res.status(500).json({ error: '이미지 업로드 중 오류가 발생했습니다' });
  }
};

// 도면 저장/업데이트 (upsert)
export const saveDrawing = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, type, imageUrl, markers, rooms, naverTypeSqm, naverTypePyeong, naverArea } = req.body;
    const userId = req.user?.id;

    if (!projectId || !type) {
      res.status(400).json({ message: '프로젝트 ID와 도면 종류는 필수입니다' });
      return;
    }

    // upsert: 있으면 업데이트, 없으면 생성
    const drawing = await Drawing.findOneAndUpdate(
      { projectId, type },
      {
        projectId,
        type,
        imageUrl,
        markers: markers || [],
        rooms: rooms || [],
        naverTypeSqm,
        naverTypePyeong,
        naverArea,
        lastModifiedBy: userId,
        $setOnInsert: { createdBy: userId }
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    res.status(200).json(drawing);
  } catch (error) {
    console.error('도면 저장 오류:', error);
    res.status(500).json({ message: '도면 저장 중 오류가 발생했습니다' });
  }
};

// 특정 도면 조회
export const getDrawing = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, type } = req.params;

    if (!projectId || !type) {
      res.status(400).json({ message: '프로젝트 ID와 도면 종류는 필수입니다' });
      return;
    }

    const drawing = await Drawing.findOne({
      projectId: new mongoose.Types.ObjectId(projectId),
      type: decodeURIComponent(type)
    });

    if (!drawing) {
      res.status(404).json({ message: '도면을 찾을 수 없습니다' });
      return;
    }

    res.status(200).json(drawing);
  } catch (error) {
    console.error('도면 조회 오류:', error);
    res.status(500).json({ message: '도면 조회 중 오류가 발생했습니다' });
  }
};

// 프로젝트의 모든 도면 목록 조회
export const getDrawingsByProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      res.status(400).json({ message: '프로젝트 ID는 필수입니다' });
      return;
    }

    const drawings = await Drawing.find({
      projectId: new mongoose.Types.ObjectId(projectId)
    }).select('type updatedAt');

    res.status(200).json(drawings);
  } catch (error) {
    console.error('도면 목록 조회 오류:', error);
    res.status(500).json({ message: '도면 목록 조회 중 오류가 발생했습니다' });
  }
};

// 도면 삭제
export const deleteDrawing = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, type } = req.params;

    if (!projectId || !type) {
      res.status(400).json({ message: '프로젝트 ID와 도면 종류는 필수입니다' });
      return;
    }

    const result = await Drawing.findOneAndDelete({
      projectId: new mongoose.Types.ObjectId(projectId),
      type: decodeURIComponent(type)
    });

    if (!result) {
      res.status(404).json({ message: '삭제할 도면을 찾을 수 없습니다' });
      return;
    }

    res.status(200).json({ message: '도면이 삭제되었습니다' });
  } catch (error) {
    console.error('도면 삭제 오류:', error);
    res.status(500).json({ message: '도면 삭제 중 오류가 발생했습니다' });
  }
};
