import { describe, it, expect, beforeAll } from 'vitest';
import {
  app,
  db,
  request,
  registerAndLogin,
  bearer,
  uniqueEmail,
  flushAsyncWrites,
  type AuthContext,
} from './helpers';

/**
 * Sprint 17 — audit logging middleware.
 *
 * Records every successful state-changing request (POST/PUT/PATCH/DELETE) to
 * `audit_logs`, skipping reads, unauthenticated calls, and error responses,
 * and redacting secret fields from the metadata summary.
 */
describe('audit: mutation logging + secret redaction', () => {
  let ctx: AuthContext;

  beforeAll(async () => {
    ctx = await registerAndLogin();
  });

  it('records a row for a successful create (POST)', async () => {
    await request(app)
      .post('/api/v1/customers')
      .set('Authorization', bearer(ctx.token))
      .send({ name: 'Audit Customer', credit_limit: 0 })
      .expect(201);

    await flushAsyncWrites();

    const row = await db('audit_logs')
      .where({ tenant_id: ctx.user.tenantId, entity: 'customers', action: 'create' })
      .first();

    expect(row).toBeTruthy();
    expect(row.method).toBe('POST');
    expect(row.status_code).toBe(201);
    expect(row.user_id).toBe(ctx.user.id);
    expect(row.path).toBe('/api/v1/customers');
  });

  it('does NOT record read-only requests (GET)', async () => {
    const before = await db('audit_logs')
      .where({ tenant_id: ctx.user.tenantId })
      .count<{ c: number }>({ c: '*' })
      .first();

    await request(app)
      .get('/api/v1/customers')
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    await flushAsyncWrites();

    const after = await db('audit_logs')
      .where({ tenant_id: ctx.user.tenantId })
      .count<{ c: number }>({ c: '*' })
      .first();

    expect(Number(after!.c)).toBe(Number(before!.c));
  });

  it('does NOT record failed mutations (>= 400)', async () => {
    // Missing required `name` → validation 400, must not be audited.
    await request(app)
      .post('/api/v1/customers')
      .set('Authorization', bearer(ctx.token))
      .send({ credit_limit: 0 })
      .expect(400);

    await flushAsyncWrites();

    const rows = await db('audit_logs')
      .where({ tenant_id: ctx.user.tenantId, entity: 'customers' })
      .select('status_code');
    expect(rows.every((r) => r.status_code < 400)).toBe(true);
  });

  it('redacts secret fields (password) from audit metadata', async () => {
    const email = uniqueEmail('staff');
    await request(app)
      .post('/api/v1/users')
      .set('Authorization', bearer(ctx.token))
      .send({ name: 'Secret Staff', email, password: 'supersecret123', role: 'cashier' })
      .expect(201);

    await flushAsyncWrites();

    const row = await db('audit_logs')
      .where({ tenant_id: ctx.user.tenantId, entity: 'users', action: 'create' })
      .orderBy('created_at', 'desc')
      .first();

    expect(row).toBeTruthy();
    const metadata = JSON.parse(row.metadata);
    expect(metadata.password).toBe('[redacted]');
    expect(metadata.name).toBe('Secret Staff');
    // The raw secret must never appear anywhere in the stored blob.
    expect(row.metadata).not.toContain('supersecret123');
  });
});
