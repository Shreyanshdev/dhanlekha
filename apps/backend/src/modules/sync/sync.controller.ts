import { Request, Response, NextFunction } from 'express';
import * as syncService from './sync.service';
import { success, created, paginated } from '../../utils/response';

/**
 * POST /api/v1/sync/push
 * Push local offline changes to the server.
 */
export async function pushSync(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const result = await syncService.pushSync(tenantId, req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/sync/pull
 * Pull changes from other devices.
 */
export async function pullSync(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const deviceId = req.query.device_id as string;
    const sinceVersion = parseInt(req.query.since_version as string ?? '0', 10);
    const limit = parseInt(req.query.limit as string ?? '200', 10);
    const result = await syncService.pullSync(tenantId, deviceId, sinceVersion, limit);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/sync/status
 * Get sync queue health and device info.
 */
export async function getSyncStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const deviceId = req.query.device_id as string | undefined;
    const result = await syncService.getSyncStatus(tenantId, deviceId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/sync/retry
 * Retry failed sync entries.
 */
export async function retrySync(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const result = await syncService.retryFailedEntries(tenantId, req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/sync/acknowledge
 * Mark entries as successfully synced to cloud.
 */
export async function acknowledgeSync(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { entry_ids } = req.body;
    const result = await syncService.markEntriesSynced(tenantId, entry_ids);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/sync/queue
 * List sync queue entries (admin dashboard).
 */
export async function listQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const page = parseInt(req.query.page as string ?? '1', 10);
    const limit = parseInt(req.query.limit as string ?? '50', 10);
    const filters = {
      is_synced: req.query.is_synced as string,
      device_id: req.query.device_id as string,
      table_name: req.query.table_name as string,
      action: req.query.action as string,
    };
    const result = await syncService.listSyncQueue(tenantId, page, limit, filters);
    return paginated(res, result.items, { page, limit, total: result.total });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/sync/failed
 * List failed entries for retry dashboard.
 */
export async function listFailed(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const limit = parseInt(req.query.limit as string ?? '50', 10);
    const entries = await syncService.listFailedEntries(tenantId, limit);
    return success(res, entries);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/sync/devices
 * List all registered sync devices.
 */
export async function listDevices(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const devices = await syncService.listDevices(tenantId);
    return success(res, devices);
  } catch (err) {
    next(err);
  }
}
