import { Router } from 'express';
import {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
} from '../controllers/company.controller.js';
import { upload } from '../middlewares/upload.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

// Two file fields — multer attaches them to req.files.leftLogo / req.files.rightLogo
const logos = upload.fields([
  { name: 'leftLogo', maxCount: 1 },
  { name: 'rightLogo', maxCount: 1 },
]);

// Public
router.get('/', listCompanies);
router.get('/:id', getCompany);

// Protected — admin+ only
router.post('/', protect, authorize('admin', 'super_admin'), logos, createCompany);
router.put('/:id', protect, authorize('admin', 'super_admin'), logos, updateCompany);
router.delete('/:id', protect, authorize('admin', 'super_admin'), deleteCompany);

export default router;
