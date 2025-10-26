import { Router } from 'express';
import {
  getAllContractors,
  getContractorById,
  createContractor,
  updateContractor,
  deleteContractor
} from '../controllers/contractor.controller';

const router = Router();

// Get all contractors
router.get('/', getAllContractors);

// Get single contractor
router.get('/:id', getContractorById);

// Create contractor
router.post('/', createContractor);

// Update contractor
router.put('/:id', updateContractor);

// Delete contractor
router.delete('/:id', deleteContractor);

export default router;
