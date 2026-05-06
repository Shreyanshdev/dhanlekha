import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import validate from '../../middleware/validate.middleware';
import {
  pushSyncSchema,
  pullSyncSchema,
  syncStatusSchema,
  retrySyncSchema,
  syncQueueQuerySchema,
} from './sync.validator';
import * as controller from './sync.controller';

const router = Router();

router.use(requireAuth);

/**
 * POST /api/v1/sync/push
 * Push local offline changes to server.
 * Any authenticated user can push their device's changes.
 */
router.post('/push', validate(pushSyncSchema), controller.pushSync);

/**
 * GET /api/v1/sync/pull
 * Pull changes from other devices.
 * Any authenticated user can pull.
 */
router.get('/pull', validate(pullSyncSchema, 'query'), controller.pullSync);

/**
 * GET /api/v1/sync/status
 * Get sync queue health status.
 */
router.get('/status', validate(syncStatusSchema, 'query'), controller.getSyncStatus);

/**
 * GET /api/v1/sync/devices
 * List registered sync devices.
 */
router.get('/devices', controller.listDevices);

/**
 * GET /api/v1/sync/queue
 * List sync queue entries (Admin only — admin dashboard).
 */
router.get('/queue', authorize('admin'), validate(syncQueueQuerySchema, 'query'), controller.listQueue);

/**
 * GET /api/v1/sync/failed
 * List failed entries (Admin only).
 */
router.get('/failed', authorize('admin'), controller.listFailed);

/**
 * POST /api/v1/sync/retry
 * Retry failed entries (Admin only).
 */
router.post('/retry', authorize('admin'), validate(retrySyncSchema), controller.retrySync);

/**
 * POST /api/v1/sync/acknowledge
 * Mark entries as synced (Admin only — used by cloud sync worker).
 */
router.post('/acknowledge', authorize('admin'), controller.acknowledgeSync);

export default router;
