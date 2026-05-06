import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import type { SyncQueueEntry, SyncDevice } from '@dhanlekha/shared';

// ─── Allowed tables for sync operations ──────────────────────
// Whitelist of tables that can be synced. Prevents injection of
// system/meta tables into the sync pipeline.
const SYNCABLE_TABLES = new Set([
  'products',
  'inventory',
  'inventory_batches',
  'invoices',
  'invoice_items',
  'customers',
  'suppliers',
  'payments',
  'payment_allocations',
  'customer_ledger',
  'purchases',
  'purchase_items',
  'expenses',
  'offers',
  'settings',
]);

export function isSyncableTable(tableName: string): boolean {
  return SYNCABLE_TABLES.has(tableName);
}

/**
 * SyncQueueRepository
 * 
 * Manages the append-only change log for offline sync.
 * Unlike other repos, sync_queue has NO is_deleted column —
 * entries are permanent audit records.
 */
export class SyncQueueRepository {
  private tenantId: string;
  private trx?: Knex.Transaction;

  constructor(tenantId: string, trx?: Knex.Transaction) {
    this.tenantId = tenantId;
    this.trx = trx;
  }

  private getQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx('sync_queue') : db('sync_queue');
    return qb.where({ tenant_id: this.tenantId });
  }

  private getInsertQuery(): Knex.QueryBuilder {
    return this.trx ? this.trx('sync_queue') : db('sync_queue');
  }

  /**
   * Enqueue a change for sync.
   */
  async enqueue(entry: Partial<SyncQueueEntry>): Promise<void> {
    await this.getInsertQuery().insert({
      ...entry,
      tenant_id: this.tenantId,
      payload: entry.payload ? JSON.stringify(entry.payload) : null,
    });
  }

  /**
   * Batch enqueue multiple changes (e.g., push from client).
   */
  async enqueueBatch(entries: Partial<SyncQueueEntry>[]): Promise<void> {
    if (entries.length === 0) return;

    const withTenant = entries.map(e => ({
      ...e,
      tenant_id: this.tenantId,
      // Stringify payload for SQLite compatibility (no native JSONB)
      payload: e.payload ? JSON.stringify(e.payload) : null,
    }));

    // Insert in chunks to avoid SQLite variable limit
    const CHUNK_SIZE = 50;
    for (let i = 0; i < withTenant.length; i += CHUNK_SIZE) {
      const chunk = withTenant.slice(i, i + CHUNK_SIZE);
      await this.getInsertQuery().insert(chunk);
    }
  }

  /**
   * Get pending (un-synced) entries, ordered by creation time.
   * This is the main query for the sync push worker.
   */
  async findPending(limit: number = 100): Promise<SyncQueueEntry[]> {
    return await this.getQuery()
      .where('is_synced', false)
      .orderBy('created_at', 'asc')
      .limit(limit);
  }

  /**
   * Get pending entries for a specific device.
   */
  async findPendingByDevice(deviceId: string, limit: number = 100): Promise<SyncQueueEntry[]> {
    return await this.getQuery()
      .where({ is_synced: false, device_id: deviceId })
      .orderBy('version', 'asc')
      .limit(limit);
  }

  /**
   * Find entries by record — useful for conflict detection.
   * Returns all sync attempts for a specific record, newest first.
   */
  async findByRecord(tableName: string, recordId: string): Promise<SyncQueueEntry[]> {
    return await this.getQuery()
      .where({ table_name: tableName, record_id: recordId })
      .orderBy('version', 'desc');
  }

  /**
   * Mark entries as successfully synced.
   */
  async markSynced(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return await this.getQuery()
      .whereIn('id', ids)
      .update({
        is_synced: true,
        synced_at: new Date().toISOString(),
        error_message: null,
      });
  }

  /**
   * Mark a single entry as failed with an error message.
   */
  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.getQuery()
      .where({ id })
      .update({ error_message: errorMessage });
  }

  /**
   * Get entries that have previously failed (for retry dashboard).
   */
  async findFailed(limit: number = 50): Promise<SyncQueueEntry[]> {
    return await this.getQuery()
      .where('is_synced', false)
      .whereNotNull('error_message')
      .orderBy('created_at', 'asc')
      .limit(limit);
  }

  /**
   * Retry failed entries by clearing their error message.
   */
  async retryFailed(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return await this.getQuery()
      .whereIn('id', ids)
      .where('is_synced', false)
      .update({ error_message: null });
  }

  /**
   * Get sync status summary for dashboard.
   */
  async getStatus(): Promise<{
    pending: number;
    synced: number;
    failed: number;
    oldest_pending_at: string | null;
  }> {
    const [pending, synced, failed, oldest] = await Promise.all([
      this.getQuery()
        .where({ is_synced: false })
        .whereNull('error_message')
        .count('id as count')
        .first() as any,
      this.getQuery()
        .where({ is_synced: true })
        .count('id as count')
        .first() as any,
      this.getQuery()
        .where({ is_synced: false })
        .whereNotNull('error_message')
        .count('id as count')
        .first() as any,
      this.getQuery()
        .where({ is_synced: false })
        .orderBy('created_at', 'asc')
        .select('created_at')
        .first(),
    ]);

    return {
      pending: Number(pending?.count ?? 0),
      synced: Number(synced?.count ?? 0),
      failed: Number(failed?.count ?? 0),
      oldest_pending_at: oldest?.created_at ?? null,
    };
  }

  /**
   * Pull changes for a device — returns all synced entries from OTHER devices
   * that are newer than the given version. This is what clients use to stay current.
   */
  async findChangesForPull(
    deviceId: string,
    sinceVersion: number,
    limit: number = 200
  ): Promise<SyncQueueEntry[]> {
    return await this.getQuery()
      .where('is_synced', true)
      .where('device_id', '!=', deviceId) // Don't pull own changes
      .where('version', '>', sinceVersion)
      .orderBy('created_at', 'asc')
      .limit(limit);
  }

  /**
   * Get the latest version number for a specific device.
   */
  async getLatestVersion(deviceId: string): Promise<number> {
    const result = await this.getQuery()
      .where({ device_id: deviceId })
      .max('version as max_version')
      .first() as any;
    return Number(result?.max_version ?? 0);
  }

  /**
   * Paginated listing of all sync queue entries (admin view).
   */
  async listPaged(
    page: number,
    limit: number,
    filters: {
      is_synced?: string;
      device_id?: string;
      table_name?: string;
      action?: string;
    } = {}
  ): Promise<{ items: SyncQueueEntry[]; total: number }> {
    const query = this.getQuery()
      .where(builder => {
        if (filters.is_synced !== undefined) {
          builder.where('is_synced', filters.is_synced === 'true');
        }
        if (filters.device_id) builder.where('device_id', filters.device_id);
        if (filters.table_name) builder.where('table_name', filters.table_name);
        if (filters.action) builder.where('action', filters.action);
      })
      .orderBy('created_at', 'desc');

    const totalQuery = query.clone().clearSelect().clearOrder().count('id as count').first() as any;
    const itemsQuery = query.clone().offset((page - 1) * limit).limit(limit);

    const [totalRes, items] = await Promise.all([totalQuery, itemsQuery]);
    return {
      items,
      total: Number(totalRes?.count ?? 0),
    };
  }
}

/**
 * SyncDeviceRepository
 * 
 * Tracks registered devices per tenant for version management
 * and last-activity monitoring.
 */
export class SyncDeviceRepository {
  private tenantId: string;
  private trx?: Knex.Transaction;

  constructor(tenantId: string, trx?: Knex.Transaction) {
    this.tenantId = tenantId;
    this.trx = trx;
  }

  private getQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx('sync_devices') : db('sync_devices');
    return qb.where({ tenant_id: this.tenantId });
  }

  private getInsertQuery(): Knex.QueryBuilder {
    return this.trx ? this.trx('sync_devices') : db('sync_devices');
  }

  /**
   * Register or update a device (upsert pattern).
   * Called on every push/pull to keep the registry current.
   */
  async upsert(deviceId: string, deviceName?: string): Promise<SyncDevice> {
    const existing = await this.getQuery()
      .where({ device_id: deviceId })
      .first();

    if (existing) {
      await this.getQuery()
        .where({ device_id: deviceId })
        .update({
          last_seen_at: new Date().toISOString(),
          ...(deviceName ? { device_name: deviceName } : {}),
        });
      return { ...existing, last_seen_at: new Date().toISOString() };
    }

    const device: Partial<SyncDevice> = {
      id: uuidv4(),
      tenant_id: this.tenantId,
      device_id: deviceId,
      device_name: deviceName ?? null,
      last_version: 0,
      last_seen_at: new Date().toISOString(),
    };

    await this.getInsertQuery().insert(device);
    return device as SyncDevice;
  }

  /**
   * Update the last synced version for a device.
   */
  async updateLastVersion(deviceId: string, version: number): Promise<void> {
    await this.getQuery()
      .where({ device_id: deviceId })
      .update({
        last_version: version,
        last_seen_at: new Date().toISOString(),
      });
  }

  /**
   * Get device info.
   */
  async findByDeviceId(deviceId: string): Promise<SyncDevice | undefined> {
    return await this.getQuery()
      .where({ device_id: deviceId })
      .first();
  }

  /**
   * List all registered devices for a tenant.
   */
  async findAll(): Promise<SyncDevice[]> {
    return await this.getQuery()
      .orderBy('last_seen_at', 'desc');
  }
}
