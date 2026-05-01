import app from './app';
import env from './config/env';
import db from './config/database';
import { connectRedis } from './config/redis';

async function start() {
  console.log('─────────────────────────────────────────');
  console.log('  DhanLekha ERP — Backend Server');
  console.log(`  Environment: ${env.nodeEnv}`);
  console.log('─────────────────────────────────────────');

  // ── Verify Database Connection ──
  try {
    await db.raw('SELECT 1');
    console.log('[Database] Connected successfully');
  } catch (error) {
    console.error('[Database] Connection failed:', error.message);
    process.exit(1);
  }

  // ── Connect Redis (optional — system works without it) ──
  await connectRedis();

  // ── Start HTTP Server ──
  app.listen(env.port, () => {
    console.log(`[Server] Running on http://localhost:${env.port}`);
    console.log(`[Health] http://localhost:${env.port}/api/v1/health`);
    console.log('─────────────────────────────────────────');
  });
}

start().catch((error) => {
  console.error('[Fatal] Server failed to start:', error);
  process.exit(1);
});
