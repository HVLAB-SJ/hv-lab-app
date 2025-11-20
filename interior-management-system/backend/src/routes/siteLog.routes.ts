import express from 'express';
import {
  getAllLogs,
  getProjectLogs,
  getLogsByDateRange,
  createLog,
  updateLog,
  deleteLog
} from '../controllers/siteLog.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Routes
router.get('/', getAllLogs);
router.get('/project/:projectName', getProjectLogs);
router.get('/range', getLogsByDateRange);
router.post('/', createLog);
router.put('/:id', updateLog);
router.delete('/:id', deleteLog);

export default router;
