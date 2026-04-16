import { Router } from 'express';
import {
  listKpis,
  getKpi,
  createKpi,
  updateKpi,
  deleteKpi,
} from '../controllers/kpi.controller.js';
import { upload } from '../middlewares/upload.js';

const router = Router();

// frontend sends the file under field name "KpiIcon"
router.get('/', listKpis);                 // supports ?sectorId= &categoryId= &indicatorId=
router.get('/:id', getKpi);
router.post('/', upload.single('KpiIcon'), createKpi);
router.put('/:id', upload.single('KpiIcon'), updateKpi);
router.delete('/:id', deleteKpi);

export default router;
