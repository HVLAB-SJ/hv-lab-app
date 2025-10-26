import { Router } from 'express';
import {
  getAllASRequests,
  getASRequestById,
  createASRequest,
  updateASRequest,
  deleteASRequest
} from '../controllers/asrequest.controller';

const router = Router();

router.get('/', getAllASRequests);
router.get('/:id', getASRequestById);
router.post('/', createASRequest);
router.put('/:id', updateASRequest);
router.delete('/:id', deleteASRequest);

export default router;
