import { v4 as uuidv4 } from 'uuid';
import { SyncQueueRepository, SyncDeviceRepository, isSyncableTable } from '../../repositories/sync.repo';
import { withTransaction } from '../../database/transaction';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import type { SyncQueueEntry, SyncDevice } from '@dhanlekha/shared';
import type { PushSyncInput, RetrySyncInput } from './sync.validator';

/**
 * ═══════════════════════════════════════════════════════════════
 * PUSH: Client → Server
 * 
 * Receives offline changes from a device and processes them:
 *   1. Validates all entries against the syncable table whitelist
 *   2. Detects version conflicts per device
 *   3. Enqueues valid entries into sync_queue
 *   4. Updates the device registry
 *   5. Returns a detailed receipt of accepted/rejected entries
 * ═══════════════════════════════════════════════════════════════
 */
export async function pushSync(
  tenantId: string,
  data: PushSyncInput
): Promise<{
  accepted: number;
  rejected: { id: string; reason: string }[];
  device: SyncDevice;
  server_version: number;
}> {
  return await withTransaction(async (trx) => {
    const syncRepo = new SyncQueueRepository(tenantId, trx);
    const deviceRepo = new SyncDeviceRepository(tenantId, trx);

    // 1. Register / update device
    const device = await deviceRepo.upsert(data.device_id, data.device_name);

    // 2. Validate & prepare entries
    const accepted: Partial<SyncQueueEntry>[] = [];
    const rejected: { id: string; reason: string }[] = [];

    for (const entry of data.entries) {
      // 2a. Table whitelist check
      if (!isSyncableTable(entry.table_name)) {
        rejected.push({
          id: entry.id,
          reason: `Table '${entry.table_name}' is not syncable`,
        });
        continue;
      }

      // 2b. Version ordering — reject stale entries
      //     (version must be greater than device's last synced version)
      if (entry.version <= device.last_version) {
        rejected.push({
          id: entry.id,
          reason: `Stale version ${entry.version} (device last_version: ${device.last_version})`,
        });
        continue;
      }

      // 2c. Conflict detection — check if another device has modified this record
      const existingChanges = await syncRepo.findByRecord(entry.table_name, entry.record_id);
      const hasConflict = existingChanges.some(
        e => e.device_id !== data.device_id && e.is_synced && e.version >= entry.version
      );

      if (hasConflict) {
        const strategy = entry.conflict_strategy || 'server_wins';

        if (strategy === 'server_wins') {
          rejected.push({
            id: entry.id,
            reason: `Conflict detected: server has newer version (strategy: server_wins)`,
          });
          continue;
        }

        if (strategy === 'manual') {
          // For manual strategy, we accept it but flag it
          accepted.push({
            id: entry.id,
            table_name: entry.table_name,
            record_id: entry.record_id,
            action: entry.action,
            version: entry.version,
            device_id: data.device_id,
            conflict_strategy: 'manual',
            payload: entry.payload ?? null,
            is_synced: false,
            error_message: 'CONFLICT: requires manual resolution',
            created_at: entry.created_at || new Date().toISOString(),
          });
          continue;
        }

        // client_wins — falls through to normal acceptance
      }

      // 2d. Accept the entry
      accepted.push({
        id: entry.id,
        table_name: entry.table_name,
        record_id: entry.record_id,
        action: entry.action,
        version: entry.version,
        device_id: data.device_id,
        conflict_strategy: entry.conflict_strategy || 'server_wins',
        payload: entry.payload ?? null,
        is_synced: false,
        created_at: entry.created_at || new Date().toISOString(),
      });
    }

    // 3. Batch insert accepted entries
    if (accepted.length > 0) {
      await syncRepo.enqueueBatch(accepted);
    }

    // 4. Update device version to the highest accepted version
    const maxVersion = accepted.reduce(
      (max, e) => Math.max(max, e.version ?? 0), device.last_version
    );
    if (maxVersion > device.last_version) {
      await deviceRepo.updateLastVersion(data.device_id, maxVersion);
    }

    // 5. Get latest server version for the response
    const serverVersion = await syncRepo.getLatestVersion(data.device_id);

    return {
      accepted: accepted.length,
      rejected,
      device: { ...device, last_version: maxVersion },
      server_version: serverVersion,
    };
  });
}

/**
 * ═══════════════════════════════════════════════════════════════
 * PULL: Server → Client
 * 
 * Returns changes from OTHER devices that the requesting device
 * hasn't seen yet. Uses version-based cursoring.
 * ═══════════════════════════════════════════════════════════════
 */
export async function pullSync(
  tenantId: string,
  deviceId: string,
  sinceVersion: number,
  limit: number
): Promise<{
  entries: SyncQueueEntry[];
  device: SyncDevice;
  has_more: boolean;
}> {
  const syncRepo = new SyncQueueRepository(tenantId);
  const deviceRepo = new SyncDeviceRepository(tenantId);

  // Register device on pull too (first-time devices auto-register)
  const device = await deviceRepo.upsert(deviceId);

  // Fetch changes from other devices
  const entries = await syncRepo.findChangesForPull(deviceId, sinceVersion, limit + 1);

  const hasMore = entries.length > limit;
  const resultEntries = hasMore ? entries.slice(0, limit) : entries;

  return {
    entries: resultEntries,
    device,
    has_more: hasMore,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════
 * STATUS: Sync health dashboard
 * 
 * Returns aggregate counts and oldest pending entry timestamp.
 * Can be scoped to a specific device or tenant-wide.
 * ═══════════════════════════════════════════════════════════════
 */
export async function getSyncStatus(
  tenantId: string,
  deviceId?: string
): Promise<{
  queue: {
    pending: number;
    synced: number;
    failed: number;
    oldest_pending_at: string | null;
  };
  devices: SyncDevice[];
  device_version?: number;
}> {
  const syncRepo = new SyncQueueRepository(tenantId);
  const deviceRepo = new SyncDeviceRepository(tenantId);

  const [queueStatus, devices] = await Promise.all([
    syncRepo.getStatus(),
    deviceRepo.findAll(),
  ]);

  const result: any = {
    queue: queueStatus,
    devices,
  };

  // If a specific device was requested, include its version
  if (deviceId) {
    const version = await syncRepo.getLatestVersion(deviceId);
    result.device_version = version;
  }

  return result;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * RETRY: Re-attempt failed sync entries
 * 
 * Clears the error_message on specified entries so they become
 * eligible for the next push cycle.
 * ═══════════════════════════════════════════════════════════════
 */
export async function retryFailedEntries(
  tenantId: string,
  data: RetrySyncInput
): Promise<{ retried: number }> {
  const syncRepo = new SyncQueueRepository(tenantId);
  const retried = await syncRepo.retryFailed(data.entry_ids);
  return { retried };
}

/**
 * ═══════════════════════════════════════════════════════════════
 * MARK SYNCED: Batch acknowledge entries as synced
 * 
 * Called after the cloud database has successfully applied
 * the changes. Moves entries from pending → synced.
 * ═══════════════════════════════════════════════════════════════
 */
export async function markEntriesSynced(
  tenantId: string,
  entryIds: string[]
): Promise<{ synced: number }> {
  if (entryIds.length === 0) {
    throw new BadRequestError('No entry IDs provided');
  }
  const syncRepo = new SyncQueueRepository(tenantId);
  const synced = await syncRepo.markSynced(entryIds);
  return { synced };
}

/**
 * List sync queue entries (admin dashboard).
 */
export async function listSyncQueue(
  tenantId: string,
  page: number,
  limit: number,
  filters: any
): Promise<{ items: SyncQueueEntry[]; total: number }> {
  const syncRepo = new SyncQueueRepository(tenantId);
  return await syncRepo.listPaged(page, limit, filters);
}

/**
 * List failed entries for retry dashboard.
 */
export async function listFailedEntries(
  tenantId: string,
  limit: number = 50
): Promise<SyncQueueEntry[]> {
  const syncRepo = new SyncQueueRepository(tenantId);
  return await syncRepo.findFailed(limit);
}

/**
 * List all registered devices.
 */
export async function listDevices(tenantId: string): Promise<SyncDevice[]> {
  const deviceRepo = new SyncDeviceRepository(tenantId);
  return await deviceRepo.findAll();
}
