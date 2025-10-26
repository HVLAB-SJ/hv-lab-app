import { Router } from 'express';
import {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  updatePaymentStatus,
  deletePayment
} from '../controllers/payment.controller';

const router = Router();

// Get all payments
router.get('/', getAllPayments);

// Get single payment
router.get('/:id', getPaymentById);

// Create payment
router.post('/', createPayment);

// Update payment
router.put('/:id', updatePayment);

// Update payment status
router.put('/:id/status', updatePaymentStatus);

// Delete payment
router.delete('/:id', deletePayment);

export default router;