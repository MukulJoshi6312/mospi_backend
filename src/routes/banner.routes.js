import { Router } from 'express';
import {
  listBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../controllers/banner.controller.js';
import { upload } from '../middlewares/upload.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

// Public — anyone can view
router.get('/', listBanners);
router.get('/:id', getBanner);

// Protected — admin+ can create/update/delete
router.post('/', protect, authorize('admin', 'super_admin'), upload.single('image'), createBanner);
router.put('/:id', protect, authorize('admin', 'super_admin'), upload.single('image'), updateBanner);
router.delete('/:id', protect, authorize('admin', 'super_admin'), deleteBanner);

export default router;
