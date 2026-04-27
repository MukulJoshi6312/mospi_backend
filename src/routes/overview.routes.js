import { Router } from 'express';
import { getOverview } from '../controllers/overview.controller.js';

const router = Router();

// Public — GET /api/overview/:sectorSlug
router.get('/:sectorSlug', getOverview);

export default router;
