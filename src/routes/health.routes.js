import { Router } from 'express';
import { liveness, readiness } from '../controllers/health.controller.js';

const router = Router();

router.get('/', liveness);          // GET /api/health
router.get('/ready', readiness);    // GET /api/health/ready

export default router;
