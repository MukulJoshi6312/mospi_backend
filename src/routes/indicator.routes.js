import { Router } from 'express';
import {
  listIndicators,
  getIndicator,
  createIndicator,
  updateIndicator,
  deleteIndicator,
} from '../controllers/indicator.controller.js';
import { upload } from '../middlewares/upload.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

// Public
router.get('/', listIndicators);
router.get('/:id', getIndicator);

// Protected — admin+ can manage
router.post('/', protect, authorize('admin', 'super_admin'), upload.single('indicatorIcon'), createIndicator);
router.put('/:id', protect, authorize('admin', 'super_admin'), upload.single('indicatorIcon'), updateIndicator);
router.delete('/:id', protect, authorize('admin', 'super_admin'), deleteIndicator);

export default router;
