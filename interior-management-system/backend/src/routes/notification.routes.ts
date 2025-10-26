import { Router } from 'express';

const router = Router();

router.get('/', async (req, res) => {
  res.json({ message: 'Get notifications' });
});

router.put('/:id/read', async (req, res) => {
  res.json({ message: 'Mark as read' });
});

export default router;