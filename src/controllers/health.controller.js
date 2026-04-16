import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Liveness — "am I running?" Fast, no external calls. Used by Docker/k8s.
export const liveness = (_req, res) =>
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });

// Readiness — "am I able to serve traffic?" Checks DB + reports metrics.
export const readiness = asyncHandler(async (_req, res) => {
  const start = Date.now();
  let dbOk = false;
  let dbLatencyMs = null;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
    dbLatencyMs = Date.now() - start;
  } catch {
    dbOk = false;
  }

  const mem = process.memoryUsage();
  const healthy = dbOk;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      database: { ok: dbOk, latencyMs: dbLatencyMs },
    },
    memory: {
      rssMB: +(mem.rss / 1024 / 1024).toFixed(1),
      heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(1),
    },
    nodeVersion: process.version,
  });
});
