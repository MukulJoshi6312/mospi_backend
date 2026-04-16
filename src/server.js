import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { pool } from './config/db.js';

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Handle listen errors (e.g. EADDRINUSE) cleanly — exit with a helpful hint
// instead of running the full shutdown dance on a server that never started.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use.`);
    console.error(`  • See what's using it:  lsof -iTCP:${PORT} -sTCP:LISTEN`);
    console.error(`  • Or change PORT in your .env file.\n`);
  } else {
    console.error('HTTP server error:', err);
  }
  process.exit(1);
});

// Protection against slow-loris & header-flood attacks.
server.headersTimeout = 65_000;
server.requestTimeout = 60_000;
server.keepAliveTimeout = 61_000;

// --- Graceful shutdown ------------------------------------------------------
// Only runs once the server is actually listening.
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} received — shutting down...`);
  const forceKill = setTimeout(() => {
    console.error('Shutdown took too long, forcing exit.');
    process.exit(1);
  }, 10_000);
  forceKill.unref();

  if (!server.listening) {
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }

  server.close(async (err) => {
    if (err) console.error('Error closing HTTP server', err);
    try {
      await pool.end();
      console.log('Clean shutdown complete.');
      process.exit(0);
    } catch (e) {
      console.error('Error closing Postgres pool', e);
      process.exit(1);
    }
  });
};

['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException');
});
