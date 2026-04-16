import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';

import routes from './routes/index.js';
import { requestId } from './middlewares/requestId.js';
import { httpLogger } from './middlewares/logger.js';
import { globalLimiter } from './middlewares/rateLimiter.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

const app = express();

// --- Observability (must come first so IDs/logs cover everything) ---
app.use(requestId);
app.use(httpLogger);

// --- Security basics ---
app.disable('x-powered-by');
// crossOriginResourcePolicy relaxed so the frontend (different origin) can load /uploads images.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
    credentials: true,
  }),
);

// --- Body parsers + gzip ---
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Static: uploaded icons served at http://localhost:4000/uploads/<file> ---
app.use('/uploads', express.static(path.resolve('uploads')));

// --- Rate limit (everything under /api) ---
app.use('/api', globalLimiter);

// --- Routes ---
app.use('/api', routes);

// Root welcome — app.get (exact match) not app.use (prefix match).
app.get('/', (_req, res) => {
  res.send('Welcome to MOSPI API');
});

// --- 404 + error handler (must be last) ---
app.use(notFound);
app.use(errorHandler);

export default app;
