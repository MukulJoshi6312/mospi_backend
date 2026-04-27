import { Router } from 'express';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

// Public
router.get('/', listCategories);
router.get('/:id', getCategory);

// Protected — admin+ can manage
router.post('/', protect, authorize('admin', 'super_admin'), createCategory);
router.put('/:id', protect, authorize('admin', 'super_admin'), updateCategory);
router.delete('/:id', protect, authorize('admin', 'super_admin'), deleteCategory);

export default router;
