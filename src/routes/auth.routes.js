import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  me,
  updateUserRole,
  listUsers,
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Public
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', logout);

// Protected — any logged-in user
router.get('/me', protect, me);

// Admin only — manage users
router.get('/users', protect, authorize('admin', 'super_admin'), listUsers);
router.patch('/users/:id/role', protect, authorize('admin', 'super_admin'), updateUserRole);

export default router;
