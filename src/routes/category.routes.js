import { Router } from 'express';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';
import { upload } from '../middlewares/upload.js';

const router = Router();

router.get('/', listCategories);          // supports ?sectorId=
router.get('/:id', getCategory);
router.post('/', upload.single('categoryIcon'), createCategory);
router.put('/:id', upload.single('categoryIcon'), updateCategory);
router.delete('/:id', deleteCategory);

export default router;
