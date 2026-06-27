import { describe, it, expect, beforeAll } from 'vitest';
import {
  app,
  db,
  request,
  registerAndLogin,
  createProduct,
  bearer,
  uniqueEmail,
  type AuthContext,
} from './helpers';

/**
 * Sprint 18 — Double-Entry General Ledger.
 *
 * Covers: COA seeding on registration, accounts API, manual journals with
 * balance enforcement, account ledger running balances, and that invoice
 * postings are balanced and reference the source document.
 */
describe('GL: chart of accounts', () => {
  let ctx: AuthContext;

  beforeAll(async () => {
    ctx = await registerAndLogin();
  });

  it('seeds the default chart of accounts on registration', async () => {
    const res = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    const flat: any[] = [];
    const walk = (nodes: any[]) => nodes.forEach((n) => { flat.push(n); walk(n.children ?? []); });
    walk(res.body.data);

    const codes = flat.map((a) => a.account_code);
    expect(codes).toEqual(
      expect.arrayContaining(['1000', '1100', '2100', '4000', '5000', '5100'])
    );
    // System accounts are flagged (SQLite returns booleans as 1/0).
    expect(flat.find((a) => a.account_code === '4000').is_system).toBeTruthy();
    expect(flat.find((a) => a.account_code === '4000').account_type).toBe('income');
  });

  it('lets an admin create a custom account and rejects duplicate codes', async () => {
    const create = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', bearer(ctx.token))
      .send({ account_code: '6100', name: 'Rent', account_type: 'expense' })
      .expect(201);
    expect(create.body.data.account_code).toBe('6100');
    expect(create.body.data.is_system).toBe(false); // service returns a JS object, not a DB row

    await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', bearer(ctx.token))
      .send({ account_code: '6100', name: 'Rent Dup', account_type: 'expense' })
      .expect(409);
  });

  it('forbids a cashier from creating accounts (403)', async () => {
    const cashierEmail = uniqueEmail('cashier');
    await request(app)
      .post('/api/v1/users')
      .set('Authorization', bearer(ctx.token))
      .send({ name: 'Cash Ier', email: cashierEmail, password: 'password123', role: 'cashier' })
      .expect(201);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: cashierEmail, password: 'password123' })
      .expect(200);

    await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', bearer(login.body.data.token))
      .send({ account_code: '6200', name: 'Hack', account_type: 'expense' })
      .expect(403);
  });
});

describe('GL: manual journals', () => {
  let ctx: AuthContext;
  let cashId: string;
  let capitalId: string;

  beforeAll(async () => {
    ctx = await registerAndLogin();
    const accounts = await db('chart_of_accounts').where({ tenant_id: ctx.user.tenantId });
    cashId = accounts.find((a: any) => a.account_code === '1000').id;
    capitalId = accounts.find((a: any) => a.account_code === '3000').id;
  });

  it('posts a balanced manual journal', async () => {
    const res = await request(app)
      .post('/api/v1/journals')
      .set('Authorization', bearer(ctx.token))
      .send({
        narration: 'Owner capital introduced',
        lines: [
          { account_id: cashId, debit: 5000000 },
          { account_id: capitalId, credit: 5000000 },
        ],
      })
      .expect(201);

    expect(res.body.data.lines).toHaveLength(2);
    const totalDebit = res.body.data.lines.reduce((s: number, l: any) => s + l.debit, 0);
    const totalCredit = res.body.data.lines.reduce((s: number, l: any) => s + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(res.body.data.reference_type).toBe('manual');
  });

  it('rejects an unbalanced journal (400)', async () => {
    await request(app)
      .post('/api/v1/journals')
      .set('Authorization', bearer(ctx.token))
      .send({
        narration: 'Unbalanced',
        lines: [
          { account_id: cashId, debit: 1000 },
          { account_id: capitalId, credit: 900 },
        ],
      })
      .expect(400);
  });

  it('rejects a line with both debit and credit (400)', async () => {
    await request(app)
      .post('/api/v1/journals')
      .set('Authorization', bearer(ctx.token))
      .send({
        narration: 'Bad line',
        lines: [
          { account_id: cashId, debit: 1000, credit: 1000 },
          { account_id: capitalId, credit: 1000 },
        ],
      })
      .expect(400);
  });

  it('lists journal entries with their lines', async () => {
    const res = await request(app)
      .get('/api/v1/journals?reference_type=manual')
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].lines.length).toBeGreaterThanOrEqual(2);
  });
});

describe('GL: postings from money events', () => {
  let ctx: AuthContext;

  beforeAll(async () => {
    ctx = await registerAndLogin();
  });

  it('posts a balanced journal for an invoice and reflects it in account ledgers', async () => {
    const productId = await createProduct(ctx.token, { selling_price: 10000, gst_rate: 18 });

    const inv = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(ctx.token))
      .send({ items: [{ product_id: productId, quantity: 2 }], amount_paid: 23600 })
      .expect(201);

    const invoiceId = inv.body.data.id;

    // The journal exists, references the invoice, and balances.
    const entry = await db('journal_entries')
      .where({ tenant_id: ctx.user.tenantId, reference_type: 'invoice', reference_id: invoiceId })
      .first();
    expect(entry).toBeTruthy();

    const lines = await db('journal_lines').where({ journal_entry_id: entry.id });
    const totalDebit = lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
    expect(totalDebit).toBe(totalCredit);
    // subtotal 20000 + tax 3600 = 23600 on each side.
    expect(totalDebit).toBe(23600);

    // Sales account ledger shows a 20000 credit; with income normal-balance the
    // running/closing balance is +20000.
    const accounts = await db('chart_of_accounts').where({ tenant_id: ctx.user.tenantId });
    const salesId = accounts.find((a: any) => a.account_code === '4000').id;

    const ledger = await request(app)
      .get(`/api/v1/accounts/${salesId}/ledger`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    expect(ledger.body.data.total_credit).toBe(20000);
    expect(ledger.body.data.closing_balance).toBe(20000);
    expect(ledger.body.data.entries.at(-1).running_balance).toBe(20000);
  });

  it('keeps the whole books balanced across many events (sum debit === sum credit)', async () => {
    const productId = await createProduct(ctx.token, { selling_price: 4999, gst_rate: 5 });

    // A credit sale (no payment), then a fully-paid sale.
    await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(ctx.token))
      .send({ items: [{ product_id: productId, quantity: 3 }], amount_paid: 0 })
      .expect(201);

    await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', bearer(ctx.token))
      .send({ items: [{ product_id: productId, quantity: 1 }], amount_paid: 5249 })
      .expect(201);

    // An expense (Dr Expense, Cr Cash).
    await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', bearer(ctx.token))
      .send({ branch_id: ctx.user.branchId, category: 'electricity', amount: 12000, payment_mode: 'cash' })
      .expect(201);

    const totals = await db('journal_lines')
      .where({ tenant_id: ctx.user.tenantId })
      .sum({ debit: 'debit', credit: 'credit' })
      .first();

    expect(Number(totals!.debit)).toBe(Number(totals!.credit));
    expect(Number(totals!.debit)).toBeGreaterThan(0);
  });
});
