import { Router } from 'express';
import {
  getAllRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord
} from '../controllers/executionRecord.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// 모든 라우트에 인증 적용
router.use(authenticate);

// 모든 실행내역 조회
router.get('/', getAllRecords);

// 단일 실행내역 조회
router.get('/:id', getRecordById);

// 실행내역 생성
router.post('/', createRecord);

// 실행내역 수정
router.put('/:id', updateRecord);

// 실행내역 삭제
router.delete('/:id', deleteRecord);

export default router;
