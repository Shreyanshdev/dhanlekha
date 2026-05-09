import app from './app';
import env from './config/env';
import logger from './config/logger';
import db from './config/database';
import { connectRedis, getRedisClient } from './config/redis';
import { initJobScheduler, shutdownJobScheduler } from './jobs/scheduler';

async function start(): Promise<void> {
  logger.info('─────────────────────────────────────────');
  logger.info('  DhanLekha ERP — Backend Server');
  logger.info({ environment: env.nodeEnv }, `  Environment: ${env.nodeEnv}`);
  logger.info('─────────────────────────────────────────');

  // ── Verify Database Connection ──
  try {
    await db.raw('SELECT 1');
    logger.info('[Database] Connected successfully');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.fatal({ err: error }, `[Database] Connection failed: ${msg}`);
    process.exit(1);
  }

  // ── Connect Redis (optional — system works without it) ──
  await connectRedis();

  // ── Start HTTP Server ──
  const server = app.listen(env.port, () => {
    logger.info(`[Server] Running on http://localhost:${env.port}`);
    logger.info(`[Health] http://localhost:${env.port}/api/v1/health`);
    logger.info('─────────────────────────────────────────');
  });

  // ── Initialize Background Jobs (requires Redis) ──
  await initJobScheduler();

  // ── Graceful Shutdown ──
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(() => {
      logger.info('[Server] HTTP server closed.');
    });

    try {
      await shutdownJobScheduler();
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        logger.info('[Redis] Connection closed.');
      }
      await db.destroy();
      logger.info('[Database] Connection closed.');
      logger.info('[Server] Shutdown complete. Goodbye!');
      process.exit(0);
    } catch (err: unknown) {
      logger.error({ err }, '[Server] Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
  process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker stop or tsx restart
}

start().catch((error: unknown) => {
  logger.fatal({ err: error }, '[Fatal] Server failed to start');
  process.exit(1);
});
