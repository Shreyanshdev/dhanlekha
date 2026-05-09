import { getRedisClient } from '../config/redis';

/**
 * Redis Cache Service — Wraps Redis get/set with:
 *   1. Graceful fallback when Redis is unavailable
 *   2. Automatic JSON serialization/deserialization
 *   3. Configurable TTL with sensible defaults
 *   4. Pattern-based cache invalidation
 *
 * Usage:
 *   const data = await cacheService.getOrSet('key', () => expensiveQuery(), 300);
 */

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get a value from cache.
 * Returns null if Redis is unavailable or key doesn't exist.
 */
async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;

    const data = await client.get(key);
    if (!data) return null;

    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Set a value in cache with TTL (seconds).
 * Silently fails if Redis is unavailable.
 */
async function cacheSet(key: string, value: unknown, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // Redis unavailable — silently continue
  }
}

/**
 * Get from cache or execute fetcher and cache the result.
 * This is the primary API — use this for most read-through scenarios.
 */
async function cacheGetOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number = DEFAULT_TTL): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  // Cache miss — execute fetcher
  const fresh = await fetcher();

  // Store in cache (fire-and-forget, don't block caller)
  cacheSet(key, fresh, ttlSeconds).catch(() => {});

  return fresh;
}

/**
 * Delete a specific key from cache.
 */
async function cacheDel(key: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    await client.del(key);
  } catch {
    // Redis unavailable
  }
}

/**
 * Delete all keys matching a glob pattern (e.g., 'tenant:abc:*').
 * Uses SCAN to avoid blocking Redis on large keyspaces.
 */
async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    // SCAN-based iteration to find matching keys without blocking
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      await client.del(key);
    }
  } catch {
    // Redis unavailable
  }
}

// ─── Public API (named exports for clear usage) ───

export const cacheService = {
  get: cacheGet,
  set: cacheSet,
  getOrSet: cacheGetOrSet,
  del: cacheDel,
  delPattern: cacheDelPattern,
};

// ─── Cache Key Builders ───

export const cacheKeys = {
  /** Plan features for a specific plan */
  planFeatures: (planId: string): string => `plan:${planId}:features`,

  /** Feature gate check for a tenant */
  tenantFeature: (tenantId: string, featureId: string): string => `tenant:${tenantId}:feature:${featureId}`,

  /** Product by barcode (hot path — barcode scanner) */
  productBarcode: (tenantId: string, barcode: string): string => `product:${tenantId}:barcode:${barcode}`,

  /** Product by ID */
  productById: (tenantId: string, productId: string): string => `product:${tenantId}:${productId}`,

  /** Dashboard summary */
  dashboard: (tenantId: string, branchId?: string): string => `dashboard:${tenantId}:${branchId || 'all'}`,

  /** Invalidation patterns — use with delPattern() */
  allTenantProducts: (tenantId: string): string => `product:${tenantId}:*`,
  allTenantDashboard: (tenantId: string): string => `dashboard:${tenantId}:*`,
};
