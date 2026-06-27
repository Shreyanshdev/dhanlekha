import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuditLogRepository } from '../repositories/auditLog.repo';
import logger from '../config/logger';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ACTION_BY_METHOD: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};
const REDACTED_KEYS = new Set(['password', 'password_hash', 'token', 'refresh_token', 'pin', 'offline_pin']);

/** Derive the resource name from a path like `/api/v1/invoices/123` → `invoices`. */
function deriveEntity(path: string): string {
  const cleaned = path.replace(/^\/api\/v\d+\//, '').split('?')[0];
  const segment = cleaned.split('/')[0];
  return segment || 'root';
}

/** Build a small, secret-free JSON summary of the request body. */
function safeMetadata(req: Request): string | null {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const summary: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    summary[key] = REDACTED_KEYS.has(key) ? '[redacted]' : undefined;
    if (!REDACTED_KEYS.has(key)) {
      const val = (body as Record<string, unknown>)[key];
      // Keep scalars only; skip large nested payloads to keep logs lean.
      summary[key] = typeof val === 'object' && val !== null ? '[object]' : val;
    }
  }
  try {
    return JSON.stringify(summary).slice(0, 2000);
  } catch {
    return null;
  }
}

/**
 * auditLog — records every successful state-changing request to `audit_logs`.
 *
 * Runs on response `finish` so it never blocks or fails the request. Skipped
 * for read-only methods, unauthenticated requests, and error responses (>=400).
 */
export function auditLog(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    try {
      if (!MUTATING_METHODS.has(req.method)) return;
      if (!req.user) return; // need a tenant context to scope the log
      if (res.statusCode >= 400) return;

      const repo = new AuditLogRepository();
      void repo
        .record({
          id: uuidv4(),
          tenant_id: req.user.tenantId,
          user_id: req.user.userId ?? null,
          branch_id: req.user.branchId ?? null,
          action: ACTION_BY_METHOD[req.method] ?? req.method.toLowerCase(),
          entity: deriveEntity(req.originalUrl || req.path),
          entity_id: (req.params?.id as string) ?? null,
          method: req.method,
          path: (req.originalUrl || req.path).split('?')[0],
          status_code: res.statusCode,
          ip_address: req.ip ?? null,
          metadata: safeMetadata(req),
        })
        .catch((err) => logger.warn({ err }, '[Audit] Failed to write audit log'));
    } catch (err) {
      logger.warn({ err }, '[Audit] Unexpected error while auditing request');
    }
  });

  next();
}

export default auditLog;
