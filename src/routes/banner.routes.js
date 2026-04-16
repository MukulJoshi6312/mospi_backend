import { Router } from 'express';
import {
  listBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../controllers/banner.controller.js';

const router = Router();

router.get('/', listBanners);
router.get('/:id', getBanner);
router.post('/', createBanner);
router.put('/:id', updateBanner);
router.delete('/:id', deleteBanner);

export default router;
