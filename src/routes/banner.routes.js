import { Router } from 'express';
import {
  listBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../controllers/banner.controller.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

// Public — anyone can view
router.get('/', listBanners);
router.get('/:id', getBanner);

// Protected — admin+ can create/update/delete
router.post('/', protect, authorize('admin', 'super_admin'), createBanner);
router.put('/:id', protect, authorize('admin', 'super_admin'), updateBanner);
router.delete('/:id', protect, authorize('admin', 'super_admin'), deleteBanner);

export default router;
