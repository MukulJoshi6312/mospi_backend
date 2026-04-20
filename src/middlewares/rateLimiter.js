import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const globalMax = Number(process.env.RATE_LIMIT_MAX) || 1000;
const authMax = Number(process.env.AUTH_RATE_LIMIT_MAX) || 50;

const base = {
  // draft-7 sends: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
  // → frontend can display a "meter" of remaining requests.
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
};

// Skip rate limiting entirely in development.
const skip = isDev ? () => true : undefined;

// Everything under /api gets this.
export const globalLimiter = rateLimit({ ...base, windowMs, max: globalMax, skip });

// Stricter limit on login / register / refresh to blunt brute-force.
export const authLimiter = rateLimit({
  ...base,
  windowMs,
  max: authMax,
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  skip,
});
