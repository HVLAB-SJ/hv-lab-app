import { Request, Response } from 'express';
import Drawing from '../models/Drawing.model';
import mongoose from 'mongoose';

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
