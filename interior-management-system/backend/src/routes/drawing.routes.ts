import { Router } from 'express';
import {
  saveDrawing,
  getDrawing,
  getDrawingsByProject,
  deleteDrawing
} from '../controllers/drawing.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// 모든 도면 라우트에 인증 적용
router.use(authenticate);

// 도면 저장/업데이트
router.post('/', saveDrawing);

// 프로젝트의 모든 도면 목록 조회
router.get('/project/:projectId', getDrawingsByProject);

// 특정 도면 조회
router.get('/:projectId/:type', getDrawing);

// 도면 삭제
router.delete('/:projectId/:type', deleteDrawing);

export default router;
