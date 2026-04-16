import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  me,
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// The auth endpoints get the stricter rate limit so brute-force attempts
// are throttled while normal /api usage isn't affected.
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', logout);
router.get('/me', protect, me);

export default router;
