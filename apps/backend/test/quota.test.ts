import { describe, it, expect, beforeAll } from 'vitest';
import {
  app,
  db,
  request,
  registerAndLogin,
  createProduct,
  bearer,
  type AuthContext,
} from './helpers';

/**
 * Sprint 17 — SaaS monthly invoice quota enforcement (featureGate middleware).
 *
 * Rather than minting 100 invoices (the starter plan default), we install a
 * tenant_override capping `max_invoices_per_month` at 2 and prove the gate
 * blocks the 3rd attempt with 403.
 */
describe('quota: monthly invoice limit (featureGate)', () => {
  let ctx: AuthContext;
  let productId: string;

  beforeAll(async () => {
    ctx = await registerAndLogin();
    productId = await createProduct(ctx.token, { selling_price: 1000, initial_quantity: 1000 });

    await db('tenant_overrides').insert({
      tenant_id: ctx.user.tenantId,
      feature_id: 'max_invoices_per_month',
      limit_value: 2,
      is_enabled: true,
    });
  });

  async function createInvoice() {
    return request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(ctx.token))
      .send({ items: [{ product_id: productId, quantity: 1 }], amount_paid: 0 });
  }

  it('allows invoices up to the limit then blocks with 403', async () => {
    await createInvoice().then((r) => expect(r.status).toBe(201));
    await createInvoice().then((r) => expect(r.status).toBe(201));

    const blocked = await createInvoice();
    expect(blocked.status).toBe(403);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.error.message).toMatch(/limit reached/i);
  });

  it('meters usage in usage_tracking for the current month', async () => {
    const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM
    const row = await db('usage_tracking')
      .where({
        tenant_id: ctx.user.tenantId,
        feature_id: 'max_invoices_per_month',
        month_year: monthYear,
      })
      .first();

    // Exactly the two successful invoices were metered; the blocked one was not.
    expect(row).toBeTruthy();
    expect(Number(row.used_count)).toBe(2);
  });

  it('lifts the block once the override limit is raised', async () => {
    await db('tenant_overrides')
      .where({ tenant_id: ctx.user.tenantId, feature_id: 'max_invoices_per_month' })
      .update({ limit_value: 10 });

    const res = await createInvoice();
    expect(res.status).toBe(201);
  });
});
