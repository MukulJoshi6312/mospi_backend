import { Router } from 'express';
import {
  listSectors,
  getSector,
  createSector,
  updateSector,
  deleteSector,
} from '../controllers/sector.controller.js';
import { upload } from '../middlewares/upload.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

// Public
router.get('/', listSectors);
router.get('/:id', getSector);

// Protected — admin+ can manage
router.post('/', protect, authorize('admin', 'super_admin'), upload.single('icon'), createSector);
router.put('/:id', protect, authorize('admin', 'super_admin'), upload.single('icon'), updateSector);
router.delete('/:id', protect, authorize('admin', 'super_admin'), deleteSector);

export default router;
