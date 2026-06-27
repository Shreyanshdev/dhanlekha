import request from 'supertest';
import app from '../src/app';
import db from '../src/config/database';

export { app, db, request };

let counter = 0;

/** Generate a unique tenant email so each test gets an isolated tenant. */
export function uniqueEmail(prefix = 'shop'): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}@test.local`;
}

export interface AuthContext {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'cashier';
    tenantId: string;
    branchId: string | null;
  };
  email: string;
  password: string;
}

/** Register a brand-new tenant + admin, then log in and return the JWT context. */
export async function registerAndLogin(
  opts: { planId?: 'starter' | 'growth' | 'enterprise' } = {}
): Promise<AuthContext> {
  const email = uniqueEmail();
  const password = 'password123';

  await request(app)
    .post('/api/v1/auth/register')
    .send({
      tenantName: 'Test Shop',
      tenantEmail: email,
      userName: 'Owner',
      password,
      planId: opts.planId ?? 'starter',
    })
    .expect(201);

  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  return { token: res.body.data.token, user: res.body.data.user, email, password };
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

/** Create a product (with branch inventory) as the given admin. Returns product id. */
export async function createProduct(
  token: string,
  overrides: Partial<{
    name: string;
    gst_rate: number;
    selling_price: number;
    initial_quantity: number;
    category: string | null;
  }> = {}
): Promise<string> {
  const res = await request(app)
    .post('/api/v1/products')
    .set('Authorization', bearer(token))
    .send({
      name: overrides.name ?? 'Test Product',
      gst_rate: overrides.gst_rate ?? 18,
      base_unit: 'pcs',
      category: overrides.category ?? null,
      initial_quantity: overrides.initial_quantity ?? 1000,
      selling_price: overrides.selling_price ?? 10000, // ₹100.00 in paise
      purchase_price: 5000,
      min_stock_alert: 0,
    })
    .expect(201);

  return res.body.data.id;
}

/** Create an active percentage offer scoped to a product. Returns offer id. */
export async function createPercentageOffer(
  token: string,
  productId: string,
  percent: number,
  extra: Partial<{ min_purchase_amount: number; max_uses: number }> = {}
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const future = '2099-12-31';
  const res = await request(app)
    .post('/api/v1/offers')
    .set('Authorization', bearer(token))
    .send({
      name: `${percent}% off`,
      offer_type: 'percentage',
      discount_value: percent,
      applies_to: 'product',
      applies_to_id: productId,
      min_purchase_amount: extra.min_purchase_amount ?? 0,
      max_uses: extra.max_uses ?? null,
      valid_from: today,
      valid_until: future,
    })
    .expect(201);

  return res.body.data.id;
}

/** Allow the audit middleware's `res.on('finish')` write to flush. */
export async function flushAsyncWrites(ms = 150): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
