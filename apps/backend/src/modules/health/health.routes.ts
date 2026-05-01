import { Router } from 'express';
import db from '../../config/database';
import { getRedisClient } from '../../config/redis';

const router = Router();

/**
 * GET /api/v1/health
 * Returns system health status including database and Redis connectivity.
 */
router.get('/', async (_req, res) => {
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {},
  };

  // Check SQLite / PostgreSQL
  try {
    await db.raw('SELECT 1');
    health.services.database = { status: 'connected' };
  } catch (error: any) {
    health.services.database = { status: 'disconnected', error: error.message };
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const redis = getRedisClient();
    if (redis && redis.isOpen) {
      await redis.ping();
      health.services.redis = { status: 'connected' };
    } else {
      health.services.redis = { status: 'disconnected' };
      health.status = 'degraded';
    }
  } catch (error: any) {
    health.services.redis = { status: 'disconnected', error: error.message };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json({ success: true, data: health });
});

export default router;
