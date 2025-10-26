import { Router } from 'express';
import {
  getAllSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule
} from '../controllers/schedule.controller';

const router = Router();

// @route   GET /api/schedules
router.get('/', getAllSchedules);

// @route   GET /api/schedules/:id
router.get('/:id', getScheduleById);

// @route   POST /api/schedules
router.post('/', createSchedule);

// @route   PUT /api/schedules/:id
router.put('/:id', updateSchedule);

// @route   DELETE /api/schedules/:id
router.delete('/:id', deleteSchedule);

export default router;