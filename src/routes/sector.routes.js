import { Router } from 'express';
import {
  listSectors,
  getSector,
  createSector,
  updateSector,
  deleteSector,
} from '../controllers/sector.controller.js';
import { upload } from '../middlewares/upload.js';

const router = Router();

router.get('/', listSectors);
router.get('/:id', getSector);
router.post('/', upload.single('icon'), createSector);
router.put('/:id', upload.single('icon'), updateSector);
router.delete('/:id', deleteSector);

export default router;
