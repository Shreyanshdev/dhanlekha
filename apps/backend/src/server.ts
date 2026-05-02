import app from './app';
import env from './config/env';
import db from './config/database';
import { connectRedis, getRedisClient } from './config/redis';

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
  const server = app.listen(env.port, () => {
    console.log(`[Server] Running on http://localhost:${env.port}`);
    console.log(`[Health] http://localhost:${env.port}/api/v1/health`);
    console.log('─────────────────────────────────────────');
  });

  // ── Graceful Shutdown ──
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
      console.log('[Server] HTTP server closed.');
    });

    try {
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        console.log('[Redis] Connection closed.');
      }
      await db.destroy();
      console.log('[Database] Connection closed.');
      console.log('[Server] Shutdown complete. Goodbye!');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
  process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker stop or tsx restart
}

start().catch((error) => {
  console.error('[Fatal] Server failed to start:', error);
  process.exit(1);
});
