import { Router } from 'express';
import { login, getCurrentUser, logout } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// @route   POST /api/auth/login
router.post('/login', login);

// @route   GET /api/auth/me
router.get('/me', protect, getCurrentUser);

// @route   POST /api/auth/logout
router.post('/logout', logout);

export default router;