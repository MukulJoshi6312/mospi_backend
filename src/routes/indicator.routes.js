import { Router } from 'express';
import {
  listIndicators,
  getIndicator,
  createIndicator,
  updateIndicator,
  deleteIndicator,
} from '../controllers/indicator.controller.js';
import { upload } from '../middlewares/upload.js';

const router = Router();

router.get('/', listIndicators);           // supports ?sectorId= &categoryId=
router.get('/:id', getIndicator);
router.post('/', upload.single('indicatorIcon'), createIndicator);
router.put('/:id', upload.single('indicatorIcon'), updateIndicator);
router.delete('/:id', deleteIndicator);

export default router;
