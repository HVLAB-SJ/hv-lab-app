import { Router } from 'express';
import {
  getAllAdditionalWorks,
  getAdditionalWorkById,
  createAdditionalWork,
  updateAdditionalWork,
  deleteAdditionalWork
} from '../controllers/additionalWork.controller';

const router = Router();

router.get('/', getAllAdditionalWorks);
router.get('/:id', getAdditionalWorkById);
router.post('/', createAdditionalWork);
router.put('/:id', updateAdditionalWork);
router.delete('/:id', deleteAdditionalWork);

export default router;
