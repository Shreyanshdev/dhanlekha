import { Queue, Worker } from 'bullmq';
import { getRedisClient } from '../config/redis';
import env from '../config/env';
import db from '../config/database';
import { generateDailyMetrics } from './metrics.job';
import { generateAlerts } from './alerts.job';
import { generateLedgerSnapshots } from './snapshots.job';

/**
 * BullMQ Job Scheduler — manages all recurring background jobs.
 *
 * Jobs:
 *   1. metricsAggregator  — Daily at midnight (aggregate yesterday's metrics)
 *   2. alertGenerator     — Every 15 minutes (check low stock, due payments)
 *   3. usageReset         — Monthly 1st at 00:05 (prune stale usage rows)
 *   4. ledgerSnapshot     — Daily at 00:15 (materialise customer closing balances)
 *
 * Falls back gracefully when Redis is unavailable — jobs simply don't run
 * in that case (acceptable for dev, Redis is required in production).
 */

const REDIS_CONNECTION = {
  host: env.redis.host,
  port: env.redis.port,
};

// Track queues and workers for graceful shutdown
let metricsQueue: Queue | null = null;
let alertsQueue: Queue | null = null;
let usageQueue: Queue | null = null;
let snapshotQueue: Queue | null = null;
let workers: Worker[] = [];

/**
 * Initialize all BullMQ queues and workers.
 * Call this from server.ts after Redis is connected.
 */
export async function initJobScheduler(): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    console.warn('[Jobs] Redis unavailable — background jobs disabled');
    return;
  }

  try {
    // ─── 1. Metrics Aggregator (Daily at Midnight) ───
    metricsQueue = new Queue('metrics-aggregator', { connection: REDIS_CONNECTION });
    await metricsQueue.add(
      'aggregate-daily',
      {},
      {
        repeat: { pattern: '0 0 * * *' },
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );

    const metricsWorker = new Worker('metrics-aggregator', async () => {
      console.log('[Jobs] Running: metricsAggregator');
      await generateDailyMetrics();
    }, { connection: REDIS_CONNECTION });
    workers.push(metricsWorker);

    // ─── 2. Alert Generator (Every 15 Minutes) ───
    alertsQueue = new Queue('alert-generator', { connection: REDIS_CONNECTION });
    await alertsQueue.add(
      'generate-alerts',
      {},
      {
        repeat: { pattern: '*/15 * * * *' },
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );

    const alertsWorker = new Worker('alert-generator', async () => {
      console.log('[Jobs] Running: alertGenerator');
      await generateAlerts();
    }, { connection: REDIS_CONNECTION });
    workers.push(alertsWorker);

    // ─── 3. Usage Reset (Monthly 1st at 00:05) ───
    usageQueue = new Queue('usage-reset', { connection: REDIS_CONNECTION });
    await usageQueue.add(
      'reset-monthly',
      {},
      {
        repeat: { pattern: '5 0 1 * *' },
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );

    const usageWorker = new Worker('usage-reset', async () => {
      console.log('[Jobs] Running: usageReset');
      // Usage is tracked per (tenant_id, feature_id, month_year). A new month
      // simply has no row yet (counts as 0), so "resetting" means pruning the
      // stale rows from previous months to keep the table small.
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
      const pruned = await db('usage_tracking')
        .where('month_year', '<', currentPeriod)
        .del();
      console.log(`[Jobs] Pruned ${pruned} stale usage rows (< ${currentPeriod})`);
    }, { connection: REDIS_CONNECTION });
    workers.push(usageWorker);

    // ─── 4. Ledger Snapshot (Daily at 00:15) ───
    snapshotQueue = new Queue('ledger-snapshot', { connection: REDIS_CONNECTION });
    await snapshotQueue.add(
      'generate-snapshots',
      {},
      {
        repeat: { pattern: '15 0 * * *' },
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );

    const snapshotWorker = new Worker('ledger-snapshot', async () => {
      console.log('[Jobs] Running: ledgerSnapshot');
      await generateLedgerSnapshots();
    }, { connection: REDIS_CONNECTION });
    workers.push(snapshotWorker);

    console.log('[Jobs] BullMQ scheduler initialized:');
    console.log('  • metricsAggregator  — Daily at midnight');
    console.log('  • alertGenerator     — Every 15 minutes');
    console.log('  • usageReset         — Monthly 1st at 00:05');
    console.log('  • ledgerSnapshot     — Daily at 00:15');

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[Jobs] Failed to initialize BullMQ scheduler:', msg);
    console.warn('[Jobs] Background jobs disabled — system continues without them');
  }
}

/**
 * Graceful shutdown — close all workers and queues.
 */
export async function shutdownJobScheduler(): Promise<void> {
  try {
    // Close workers first (stop processing)
    for (const worker of workers) {
      await worker.close();
    }
    workers = [];

    // Then close queues
    if (metricsQueue) await metricsQueue.close();
    if (alertsQueue) await alertsQueue.close();
    if (usageQueue) await usageQueue.close();
    if (snapshotQueue) await snapshotQueue.close();

    metricsQueue = null;
    alertsQueue = null;
    usageQueue = null;
    snapshotQueue = null;

    console.log('[Jobs] Scheduler shut down cleanly');
  } catch {
    // Ignore shutdown errors — process is exiting anyway
  }
}
