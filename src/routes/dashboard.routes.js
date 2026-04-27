import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller.js';

const router = Router();

// Public — GET /api/dashboard/:sectorSlug
router.get('/:sectorSlug', getDashboard);

export default router;
