import { Router } from 'express';
import {
  getAllWorkRequests,
  getWorkRequestById,
  createWorkRequest,
  updateWorkRequest,
  deleteWorkRequest
} from '../controllers/workrequest.controller';

const router = Router();

// @route   GET /api/workrequests
router.get('/', getAllWorkRequests);

// @route   GET /api/workrequests/:id
router.get('/:id', getWorkRequestById);

// @route   POST /api/workrequests
router.post('/', createWorkRequest);

// @route   PUT /api/workrequests/:id
router.put('/:id', updateWorkRequest);

// @route   DELETE /api/workrequests/:id
router.delete('/:id', deleteWorkRequest);

export default router;
