import { describe, it, expect, beforeAll } from 'vitest';
import {
  app,
  db,
  request,
  registerAndLogin,
  createProduct,
  createPercentageOffer,
  bearer,
  type AuthContext,
} from './helpers';

/**
 * Sprint 17 — invoice money math (integer paise) + offer auto-application.
 *
 * Product: selling_price 10000 paise (₹100.00), gst_rate 18%.
 */
describe('invoices: money math + offers', () => {
  let ctx: AuthContext;
  let productId: string;

  beforeAll(async () => {
    ctx = await registerAndLogin();
    productId = await createProduct(ctx.token, {
      selling_price: 10000,
      gst_rate: 18,
      initial_quantity: 1000,
    });
  });

  it('computes subtotal/tax/total as whole paise with no offer', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(ctx.token))
      .send({ items: [{ product_id: productId, quantity: 2 }], amount_paid: 0 })
      .expect(201);

    const inv = res.body.data;
    // 2 * 10000 = 20000 subtotal; 18% tax = 3600; final = 23600.
    expect(inv.subtotal).toBe(20000);
    expect(inv.discount_amount).toBe(0);
    expect(inv.tax_amount).toBe(3600);
    expect(inv.final_amount).toBe(23600);
    expect(inv.amount_due).toBe(23600);
    expect(inv.status).toBe('unpaid');

    // All monetary fields must be integers (no fractional paise).
    for (const field of ['subtotal', 'tax_amount', 'discount_amount', 'final_amount', 'amount_due']) {
      expect(Number.isInteger(inv[field])).toBe(true);
    }
  });

  it('sets status=partial and computes amount_due when partially paid', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(ctx.token))
      .send({ items: [{ product_id: productId, quantity: 1 }], amount_paid: 5000 })
      .expect(201);

    const inv = res.body.data;
    // subtotal 10000, tax 1800, final 11800, paid 5000 → due 6800.
    expect(inv.final_amount).toBe(11800);
    expect(inv.amount_paid).toBe(5000);
    expect(inv.amount_due).toBe(6800);
    expect(inv.status).toBe('partial');
  });

  it('auto-applies the best active offer and meters its used_count', async () => {
    const offerId = await createPercentageOffer(ctx.token, productId, 10);

    const createRes = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(ctx.token))
      .send({ items: [{ product_id: productId, quantity: 2 }], amount_paid: 0 })
      .expect(201);

    const invoiceId = createRes.body.data.id;

    // subtotal 20000; 10% offer → discount 2000; taxable 18000; tax 18% = 3240;
    // final = 20000 - 2000 + 3240 = 21240.
    const header = createRes.body.data;
    expect(header.subtotal).toBe(20000);
    expect(header.discount_amount).toBe(2000);
    expect(header.tax_amount).toBe(3240);
    expect(header.final_amount).toBe(21240);

    // Line item records the applied offer.
    const detail = await request(app)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    const item = detail.body.data.items[0];
    expect(item.offer_id).toBe(offerId);
    expect(item.discount_amount).toBe(2000);

    // Offer usage incremented exactly once for this single-line invoice.
    const offer = await request(app)
      .get(`/api/v1/offers/${offerId}`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);
    expect(offer.body.data.used_count).toBe(1);
  });

  it('rejects invoices that exceed available stock', async () => {
    const lowStockProduct = await createProduct(ctx.token, {
      name: 'Scarce Item',
      selling_price: 5000,
      initial_quantity: 3,
    });

    await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(ctx.token))
      .send({ items: [{ product_id: lowStockProduct, quantity: 10 }], amount_paid: 0 })
      .expect(400);
  });

  it('decrements inventory after a successful sale', async () => {
    const p = await createProduct(ctx.token, {
      name: 'Stock Tracked',
      selling_price: 2000,
      initial_quantity: 50,
    });

    await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(ctx.token))
      .send({ items: [{ product_id: p, quantity: 4 }], amount_paid: 0 })
      .expect(201);

    const inv = await db('inventory')
      .where({ tenant_id: ctx.user.tenantId, product_id: p })
      .first();
    expect(Number(inv.total_quantity)).toBe(46);
  });
});
