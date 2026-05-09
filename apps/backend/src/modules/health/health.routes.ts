import { Router } from 'express';
import db from '../../config/database';
import { getRedisClient } from '../../config/redis';
import logger from '../../config/logger';

const router = Router();

// Track server start time for uptime calculation
const startedAt = new Date().toISOString();

/**
 * GET /api/v1/health
 * Liveness probe — returns system health with dependency checks.
 * Used by Docker HEALTHCHECK and load balancers.
 */
router.get('/', async (_req, res) => {
  const health: Record<string, unknown> = {
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    startedAt,
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    services: {} as Record<string, unknown>,
  };

  const services = health.services as Record<string, unknown>;

  // Check database
  try {
    await db.raw('SELECT 1');
    services.database = { status: 'connected' };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    services.database = { status: 'disconnected', error: msg };
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const redis = getRedisClient();
    if (redis && redis.isOpen) {
      await redis.ping();
      services.redis = { status: 'connected' };
    } else {
      services.redis = { status: 'disconnected' };
      // Redis is optional — don't degrade status
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    services.redis = { status: 'disconnected', error: msg };
  }

  // Memory usage
  const mem = process.memoryUsage();
  health.memory = {
    rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
    heap_used: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
    heap_total: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
  };

  const statusCode = health.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json({ success: true, data: health });
});

/**
 * GET /api/v1/health/ready
 * Readiness probe — returns 200 only when the server can accept requests.
 * Used by Kubernetes/Docker to know when to route traffic.
 */
router.get('/ready', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    return res.status(200).json({ success: true, data: { ready: true } });
  } catch {
    logger.warn('Readiness check failed — database not available');
    return res.status(503).json({ success: false, data: { ready: false } });
  }
});

export default router;
