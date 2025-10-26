import { Router } from 'express';

const router = Router();

router.get('/profile', async (req, res) => {
  res.json({ message: 'Get user profile' });
});

router.put('/profile', async (req, res) => {
  res.json({ message: 'Update user profile' });
});

export default router;