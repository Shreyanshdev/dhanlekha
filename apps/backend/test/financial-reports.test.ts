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

const WIDE_FROM = '2020-01-01';
const WIDE_TO = '2099-12-31';

describe('Reports: access control', () => {
  let ctx: AuthContext;

  beforeAll(async () => {
    ctx = await registerAndLogin();
  });

  it('forbids a cashier from financial reports (403)', async () => {
    const cashierEmail = uniqueEmail('cashier');
    await request(app)
      .post('/api/v1/users')
      .set('Authorization', bearer(ctx.token))
      .send({ name: 'Cashier', email: cashierEmail, password: 'password123', role: 'cashier' })
      .expect(201);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: cashierEmail, password: 'password123' })
      .expect(200);

    await request(app)
      .get('/api/v1/reports/trial-balance')
      .set('Authorization', bearer(login.body.data.token))
      .query({ from: WIDE_FROM, to: WIDE_TO })
      .expect(403);
  });
});

describe('Reports: GL-backed statements', () => {
  let ctx: AuthContext;

  beforeAll(async () => {
    ctx = await registerAndLogin();
    const productId = await createProduct(ctx.token, { selling_price: 10000, gst_rate: 18 });

    await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(ctx.token))
      .send({ items: [{ product_id: productId, quantity: 2 }], amount_paid: 10000 })
      .expect(201);

    await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', bearer(ctx.token))
      .send({
        branch_id: ctx.user.branchId,
        category: 'electricity',
        amount: 5000,
        payment_mode: 'cash',
      })
      .expect(201);
  });

  it('returns a balanced trial balance', async () => {
    const res = await request(app)
      .get('/api/v1/reports/trial-balance')
      .set('Authorization', bearer(ctx.token))
      .query({ from: WIDE_FROM, to: WIDE_TO })
      .expect(200);

    expect(res.body.data.is_balanced).toBe(true);
    expect(res.body.data.total_debit).toBe(res.body.data.total_credit);
    expect(res.body.data.total_debit).toBeGreaterThan(0);
    expect(res.body.data.lines.length).toBeGreaterThan(0);
  });

  it('returns profit & loss with income and expenses', async () => {
    const res = await request(app)
      .get('/api/v1/reports/profit-loss')
      .set('Authorization', bearer(ctx.token))
      .query({ from: WIDE_FROM, to: WIDE_TO })
      .expect(200);

    expect(res.body.data.total_income).toBeGreaterThan(0);
    expect(res.body.data.total_expenses).toBeGreaterThan(0);
    expect(res.body.data.net_profit).toBe(
      res.body.data.total_income - res.body.data.total_expenses
    );
  });

  it('returns a balanced balance sheet', async () => {
    const res = await request(app)
      .get('/api/v1/reports/balance-sheet')
      .set('Authorization', bearer(ctx.token))
      .query({ as_of: WIDE_TO })
      .expect(200);

    expect(res.body.data.is_balanced).toBe(true);
    expect(res.body.data.total_assets).toBe(res.body.data.total_liabilities_and_equity);
    expect(res.body.data.assets.length).toBeGreaterThan(0);
  });

  it('returns cash flow with inflows and outflows', async () => {
    const res = await request(app)
      .get('/api/v1/reports/cash-flow')
      .set('Authorization', bearer(ctx.token))
      .query({ from: WIDE_FROM, to: WIDE_TO })
      .expect(200);

    expect(res.body.data.inflows).toBeGreaterThan(0);
    expect(res.body.data.outflows).toBeGreaterThan(0);
    expect(res.body.data.closing_cash).toBe(
      res.body.data.opening_cash + res.body.data.inflows - res.body.data.outflows
    );
    expect(res.body.data.by_reference_type.length).toBeGreaterThan(0);
  });

  it('returns day book entries with lines', async () => {
    const res = await request(app)
      .get('/api/v1/reports/day-book')
      .set('Authorization', bearer(ctx.token))
      .query({ from: WIDE_FROM, to: WIDE_TO })
      .expect(200);

    expect(res.body.data.entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of res.body.data.entries) {
      expect(entry.lines.length).toBeGreaterThanOrEqual(2);
      const debit = entry.lines.reduce((s: number, l: { debit: number }) => s + l.debit, 0);
      const credit = entry.lines.reduce((s: number, l: { credit: number }) => s + l.credit, 0);
      expect(debit).toBe(credit);
    }
  });
});

describe('Financial years: create & year-end close', () => {
  let ctx: AuthContext;

  beforeAll(async () => {
    ctx = await registerAndLogin();
    const productId = await createProduct(ctx.token, { selling_price: 5000, gst_rate: 0 });

    await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(ctx.token))
      .send({ items: [{ product_id: productId, quantity: 1 }], amount_paid: 5000 })
      .expect(201);
  });

  it('creates a financial year and closes it with roll-forward openings', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const year = today.slice(0, 4);

    const fy = await request(app)
      .post('/api/v1/financial-years')
      .set('Authorization', bearer(ctx.token))
      .send({
        name: `FY ${year}`,
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
      })
      .expect(201);

    expect(fy.body.data.status).toBe('open');

    const close = await request(app)
      .post(`/api/v1/financial-years/${fy.body.data.id}/close`)
      .set('Authorization', bearer(ctx.token))
      .send({
        next_year: {
          name: `FY ${Number(year) + 1}`,
          start_date: `${Number(year) + 1}-01-01`,
          end_date: `${Number(year) + 1}-12-31`,
        },
      })
      .expect(200);

    expect(close.body.data.closed.status).toBe('closed');
    expect(close.body.data.next.status).toBe('open');
    expect(close.body.data.opening_accounts).toBeGreaterThan(0);

    const tb = await request(app)
      .get('/api/v1/reports/trial-balance')
      .set('Authorization', bearer(ctx.token))
      .query({
        financial_year_id: close.body.data.next.id,
        from: `${Number(year) + 1}-01-01`,
        to: `${Number(year) + 1}-01-31`,
      })
      .expect(200);

    expect(tb.body.data.is_balanced).toBe(true);
  });

  it('lists financial years', async () => {
    const res = await request(app)
      .get('/api/v1/financial-years')
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('rejects overlapping financial years', async () => {
    const year = new Date().getFullYear();
    await request(app)
      .post('/api/v1/financial-years')
      .set('Authorization', bearer(ctx.token))
      .send({
        name: 'Overlap FY',
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
      })
      .expect(400);
  });
});
