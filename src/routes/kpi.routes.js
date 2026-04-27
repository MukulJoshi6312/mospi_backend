import { Router } from 'express';
import {
  listKpis,
  getKpi,
  createKpi,
  updateKpi,
  deleteKpi,
} from '../controllers/kpi.controller.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

// Public
router.get('/', listKpis);
router.get('/:id', getKpi);

// Protected — admin+ can manage
router.post('/', protect, authorize('admin', 'super_admin'), createKpi);
router.put('/:id', protect, authorize('admin', 'super_admin'), updateKpi);
router.delete('/:id', protect, authorize('admin', 'super_admin'), deleteKpi);

export default router;
