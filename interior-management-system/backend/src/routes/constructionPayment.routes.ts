import { Router } from 'express';
import {
  getAllConstructionPayments,
  getConstructionPaymentById,
  createConstructionPayment,
  updateConstructionPayment,
  deleteConstructionPayment
} from '../controllers/constructionPayment.controller';

const router = Router();

router.get('/', getAllConstructionPayments);
router.get('/:id', getConstructionPaymentById);
router.post('/', createConstructionPayment);
router.put('/:id', updateConstructionPayment);
router.delete('/:id', deleteConstructionPayment);

export default router;
