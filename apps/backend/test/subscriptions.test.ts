import { describe, it, expect, beforeAll } from 'vitest';
import {
  app,
  request,
  registerAndLogin,
  createProduct,
  bearer,
  uniqueEmail,
  type AuthContext,
} from './helpers';

/**
 * Sprint 17 — subscriptions module: overview (plan + usage) and plan change.
 */
describe('subscriptions: overview + change-plan', () => {
  let admin: AuthContext;

  beforeAll(async () => {
    admin = await registerAndLogin({ planId: 'starter' });
  });

  it('returns the current plan, limit features, and available plans', async () => {
    const res = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', bearer(admin.token))
      .expect(200);

    const body = res.body.data;
    expect(body.plan.id).toBe('starter');
    expect(Array.isArray(body.available_plans)).toBe(true);
    expect(body.available_plans.map((p: any) => p.id)).toEqual(
      expect.arrayContaining(['starter', 'growth', 'enterprise'])
    );

    const invoiceQuota = body.usage.find((u: any) => u.feature_id === 'max_invoices_per_month');
    expect(invoiceQuota).toBeTruthy();
    expect(invoiceQuota.limit).toBe(100); // starter default
    expect(invoiceQuota.used).toBe(0);
  });

  it('reflects metered usage after billing an invoice', async () => {
    const productId = await createProduct(admin.token, { selling_price: 1000 });
    await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(admin.token))
      .send({ items: [{ product_id: productId, quantity: 1 }], amount_paid: 0 })
      .expect(201);

    const res = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', bearer(admin.token))
      .expect(200);

    const invoiceQuota = res.body.data.usage.find(
      (u: any) => u.feature_id === 'max_invoices_per_month'
    );
    expect(invoiceQuota.used).toBe(1);
  });

  it('upgrades the plan and reflects the new limits', async () => {
    const change = await request(app)
      .post('/api/v1/subscriptions/change-plan')
      .set('Authorization', bearer(admin.token))
      .send({ plan_id: 'growth' })
      .expect(200);

    expect(change.body.data.plan.id).toBe('growth');
    const quota = change.body.data.usage.find(
      (u: any) => u.feature_id === 'max_invoices_per_month'
    );
    expect(quota.limit).toBe(1000); // growth default

    // Persisted: a fresh GET also shows growth.
    const get = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', bearer(admin.token))
      .expect(200);
    expect(get.body.data.plan.id).toBe('growth');
    expect(get.body.data.current_period_end).toBeTruthy();
  });

  it('returns 404 for an unknown plan', async () => {
    await request(app)
      .post('/api/v1/subscriptions/change-plan')
      .set('Authorization', bearer(admin.token))
      .send({ plan_id: 'does-not-exist' })
      .expect(404);
  });

  it('forbids a cashier from changing the plan (403)', async () => {
    const cashierEmail = uniqueEmail('cashier');
    await request(app)
      .post('/api/v1/users')
      .set('Authorization', bearer(admin.token))
      .send({ name: 'Cashier Jane', email: cashierEmail, password: 'password123', role: 'cashier' })
      .expect(201);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: cashierEmail, password: 'password123' })
      .expect(200);

    await request(app)
      .post('/api/v1/subscriptions/change-plan')
      .set('Authorization', bearer(login.body.data.token))
      .send({ plan_id: 'enterprise' })
      .expect(403);
  });
});
