import { z } from 'zod';

// ─── Push: Client sends local changes to server ─────────────

const syncEntrySchema = z.object({
  id: z.string().uuid(),
  table_name: z.string().min(1).max(100),
  record_id: z.string().uuid(),
  action: z.enum(['insert', 'update', 'delete']),
  version: z.number().int().positive(),
  conflict_strategy: z.enum(['server_wins', 'client_wins', 'manual']).default('server_wins'),
  payload: z.record(z.string(), z.any()).nullable().optional(),
  created_at: z.string().optional(), // ISO timestamp from client
});

export const pushSyncSchema = z.object({
  device_id: z.string().min(1, 'device_id is required').max(200),
  device_name: z.string().max(200).optional(),
  entries: z.array(syncEntrySchema)
    .min(1, 'At least one entry is required')
    .max(500, 'Maximum 500 entries per push'),
});

export type PushSyncInput = z.infer<typeof pushSyncSchema>;

// ─── Pull: Client requests changes from server ──────────────

export const pullSyncSchema = z.object({
  device_id: z.string().min(1).max(200),
  since_version: z.string().regex(/^\d+$/, 'since_version must be a number').default('0'),
  limit: z.string().regex(/^\d+$/).optional().default('200'),
});

export type PullSyncInput = z.infer<typeof pullSyncSchema>;

// ─── Status: Query sync health ──────────────────────────────

export const syncStatusSchema = z.object({
  device_id: z.string().min(1).max(200).optional(),
});

// ─── Retry: Re-attempt failed entries ───────────────────────

export const retrySyncSchema = z.object({
  entry_ids: z.array(z.string().uuid())
    .min(1, 'At least one entry ID is required')
    .max(100, 'Maximum 100 entries per retry'),
});

export type RetrySyncInput = z.infer<typeof retrySyncSchema>;

// ─── Queue listing (admin) ──────────────────────────────────

export const syncQueueQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('50'),
  is_synced: z.enum(['true', 'false']).optional(),
  device_id: z.string().max(200).optional(),
  table_name: z.string().max(100).optional(),
  action: z.enum(['insert', 'update', 'delete']).optional(),
});
