import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  me,
  updateProfile,
  changePassword,
  updateUserRole,
  listUsers,
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { upload } from '../middlewares/upload.js';

const router = Router();

// Public
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', logout);

// Protected — any logged-in user (own profile)
router.get('/me', protect, me);
router.put('/me', protect, upload.single('profilePicture'), updateProfile);
router.put('/change-password', protect, changePassword);
router.post('/change-password', protect, changePassword);

// Admin only — manage users
router.get('/users', protect, authorize('admin', 'super_admin'), listUsers);
router.patch('/users/:id/role', protect, authorize('admin', 'super_admin'), updateUserRole);

export default router;
