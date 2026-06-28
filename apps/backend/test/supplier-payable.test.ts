import { describe, it, expect, beforeAll } from 'vitest';
import {
  app,
  db,
  request,
  registerAndLogin,
  createProduct,
  createSupplier,
  createPurchase,
  bearer,
  type AuthContext,
} from './helpers';

/**
 * Sprint 19 — Accounts Payable & Supplier Payments.
 *
 * Covers: supplier ledger on purchase, outstanding payable cache,
 * supplier payments with purchase allocations, balance integrity,
 * validation guards, and GL postings for supplier payouts.
 */
describe('AP: supplier master', () => {
  let ctx: AuthContext;

  beforeAll(async () => {
    ctx = await registerAndLogin();
  });

  it('creates a supplier with zero outstanding payable', async () => {
    const supplierId = await createSupplier(ctx.token, { name: 'Fresh Supplier' });

    const res = await request(app)
      .get(`/api/v1/suppliers/${supplierId}`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    expect(res.body.data.total_payable).toBe(0);
  });
});

describe('AP: purchase postings', () => {
  let ctx: AuthContext;
  let supplierId: string;
  let productId: string;

  beforeAll(async () => {
    ctx = await registerAndLogin();
    supplierId = await createSupplier(ctx.token);
    productId = await createProduct(ctx.token);
  });

  it('records an unpaid purchase in the supplier ledger and total_payable cache', async () => {
    const purchase = await createPurchase(ctx.token, {
      branchId: ctx.user.branchId!,
      supplierId,
      productId,
      quantity: 5,
      unitPrice: 20000,
      taxRate: 18,
      paidAmount: 0,
    });

    const balance = await request(app)
      .get(`/api/v1/suppliers/${supplierId}/balance`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    expect(balance.body.data.computed_balance).toBe(purchase.total_amount);
    expect(balance.body.data.cached_balance).toBe(purchase.total_amount);
    expect(balance.body.data.is_consistent).toBe(true);

    const ledger = await request(app)
      .get(`/api/v1/suppliers/${supplierId}/ledger`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    expect(ledger.body.data).toHaveLength(1);
    expect(ledger.body.data[0].entry_type).toBe('purchase');
    expect(ledger.body.data[0].reference_id).toBe(purchase.id);
    expect(ledger.body.data[0].debit).toBe(purchase.total_amount);
    expect(ledger.body.data[0].running_balance).toBe(purchase.total_amount);
  });

  it('handles partial payment at purchase time with two ledger entries', async () => {
    const supplier2 = await createSupplier(ctx.token, { name: 'Partial Pay Supplier' });
    const purchase = await createPurchase(ctx.token, {
      branchId: ctx.user.branchId!,
      supplierId: supplier2,
      productId,
      quantity: 2,
      unitPrice: 50000,
      taxRate: 0,
      paidAmount: 50000,
    });

    const payable = purchase.total_amount - purchase.paid_amount;

    const balance = await request(app)
      .get(`/api/v1/suppliers/${supplier2}/balance`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    expect(balance.body.data.computed_balance).toBe(payable);
    expect(balance.body.data.cached_balance).toBe(payable);
    expect(balance.body.data.is_consistent).toBe(true);

    const ledger = await request(app)
      .get(`/api/v1/suppliers/${supplier2}/ledger`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    expect(ledger.body.data).toHaveLength(2);
    const types = ledger.body.data.map((e: { entry_type: string }) => e.entry_type).sort();
    expect(types).toEqual(['payment', 'purchase']);
  });

  it('posts a balanced GL journal for the purchase', async () => {
    const supplier3 = await createSupplier(ctx.token, { name: 'GL Purchase Supplier' });
    const purchase = await createPurchase(ctx.token, {
      branchId: ctx.user.branchId!,
      supplierId: supplier3,
      productId,
      quantity: 1,
      unitPrice: 100000,
      taxRate: 18,
      paidAmount: 0,
    });

    const journals = await request(app)
      .get('/api/v1/journals')
      .set('Authorization', bearer(ctx.token))
      .query({ reference_type: 'purchase', reference_id: purchase.id })
      .expect(200);

    expect(journals.body.data.length).toBeGreaterThanOrEqual(1);
    const entry = journals.body.data.find(
      (j: { reference_id: string }) => j.reference_id === purchase.id
    );
    expect(entry).toBeTruthy();

    const totalDebit = entry.lines.reduce((s: number, l: { debit: number }) => s + l.debit, 0);
    const totalCredit = entry.lines.reduce((s: number, l: { credit: number }) => s + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(purchase.total_amount);
  });
});

describe('AP: supplier payments', () => {
  let ctx: AuthContext;
  let supplierId: string;
  let productId: string;

  beforeAll(async () => {
    ctx = await registerAndLogin();
    supplierId = await createSupplier(ctx.token, { name: 'Payable Supplier' });
    productId = await createProduct(ctx.token);
  });

  it('pays a supplier and allocates to a purchase, clearing payable', async () => {
    const purchase = await createPurchase(ctx.token, {
      branchId: ctx.user.branchId!,
      supplierId,
      productId,
      quantity: 3,
      unitPrice: 10000,
      taxRate: 0,
      paidAmount: 0,
    });

    const payment = await request(app)
      .post('/api/v1/supplier-payments')
      .set('Authorization', bearer(ctx.token))
      .send({
        supplier_id: supplierId,
        amount: purchase.total_amount,
        payment_mode: 'cash',
        allocations: [{
          purchase_id: purchase.id,
          allocated_amount: purchase.total_amount,
        }],
      })
      .expect(201);

    expect(payment.body.data.status).toBe('fully_allocated');
    expect(payment.body.data.unallocated_amount).toBe(0);
    expect(payment.body.data.allocations).toHaveLength(1);

    const purchaseDetail = await request(app)
      .get(`/api/v1/purchases/${purchase.id}`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);
    expect(purchaseDetail.body.data.payment_status).toBe('paid');

    const balance = await request(app)
      .get(`/api/v1/suppliers/${supplierId}/balance`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    expect(balance.body.data.computed_balance).toBe(0);
    expect(balance.body.data.cached_balance).toBe(0);
    expect(balance.body.data.is_consistent).toBe(true);
  });

  it('supports advance payment with later allocation', async () => {
    const advSupplier = await createSupplier(ctx.token, { name: 'Advance Supplier' });
    const purchase = await createPurchase(ctx.token, {
      branchId: ctx.user.branchId!,
      supplierId: advSupplier,
      productId,
      quantity: 4,
      unitPrice: 25000,
      taxRate: 0,
      paidAmount: 0,
    });

    const advance = await request(app)
      .post('/api/v1/supplier-payments')
      .set('Authorization', bearer(ctx.token))
      .send({
        supplier_id: advSupplier,
        amount: purchase.total_amount,
        payment_mode: 'bank_transfer',
        allocations: [],
      })
      .expect(201);

    expect(advance.body.data.status).toBe('received');
    expect(advance.body.data.unallocated_amount).toBe(purchase.total_amount);

    const allocated = await request(app)
      .post(`/api/v1/supplier-payments/${advance.body.data.id}/allocate`)
      .set('Authorization', bearer(ctx.token))
      .send({
        allocations: [{
          purchase_id: purchase.id,
          allocated_amount: purchase.total_amount,
        }],
      })
      .expect(200);

    expect(allocated.body.data.status).toBe('fully_allocated');
    expect(allocated.body.data.unallocated_amount).toBe(0);

    const balance = await request(app)
      .get(`/api/v1/suppliers/${advSupplier}/balance`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    expect(balance.body.data.computed_balance).toBe(0);
    expect(balance.body.data.is_consistent).toBe(true);
  });

  it('rejects over-allocation beyond purchase due', async () => {
    const guardSupplier = await createSupplier(ctx.token, { name: 'Guard Supplier' });
    const purchase = await createPurchase(ctx.token, {
      branchId: ctx.user.branchId!,
      supplierId: guardSupplier,
      productId,
      quantity: 1,
      unitPrice: 30000,
      taxRate: 0,
      paidAmount: 0,
    });

    await request(app)
      .post('/api/v1/supplier-payments')
      .set('Authorization', bearer(ctx.token))
      .send({
        supplier_id: guardSupplier,
        amount: purchase.total_amount + 1000,
        payment_mode: 'cash',
        allocations: [{
          purchase_id: purchase.id,
          allocated_amount: purchase.total_amount + 1000,
        }],
      })
      .expect(400);
  });

  it('rejects allocating a payment to another supplier\'s purchase', async () => {
    const supplierA = await createSupplier(ctx.token, { name: 'Supplier A' });
    const supplierB = await createSupplier(ctx.token, { name: 'Supplier B' });
    const purchaseA = await createPurchase(ctx.token, {
      branchId: ctx.user.branchId!,
      supplierId: supplierA,
      productId,
      quantity: 1,
      unitPrice: 15000,
      taxRate: 0,
    });

    await request(app)
      .post('/api/v1/supplier-payments')
      .set('Authorization', bearer(ctx.token))
      .send({
        supplier_id: supplierB,
        amount: purchaseA.total_amount,
        payment_mode: 'cash',
        allocations: [{
          purchase_id: purchaseA.id,
          allocated_amount: purchaseA.total_amount,
        }],
      })
      .expect(400);
  });

  it('posts GL Dr AP / Cr Cash for supplier payment', async () => {
    const glSupplier = await createSupplier(ctx.token, { name: 'GL Pay Supplier' });
    const purchase = await createPurchase(ctx.token, {
      branchId: ctx.user.branchId!,
      supplierId: glSupplier,
      productId,
      quantity: 2,
      unitPrice: 40000,
      taxRate: 0,
      paidAmount: 0,
    });

    const payment = await request(app)
      .post('/api/v1/supplier-payments')
      .set('Authorization', bearer(ctx.token))
      .send({
        supplier_id: glSupplier,
        amount: purchase.total_amount,
        payment_mode: 'cash',
        allocations: [{
          purchase_id: purchase.id,
          allocated_amount: purchase.total_amount,
        }],
      })
      .expect(201);

    const journals = await request(app)
      .get('/api/v1/journals')
      .set('Authorization', bearer(ctx.token))
      .query({ reference_type: 'supplier_payment', reference_id: payment.body.data.id })
      .expect(200);

    const entry = journals.body.data.find(
      (j: { reference_id: string }) => j.reference_id === payment.body.data.id
    );
    expect(entry).toBeTruthy();

    const totalDebit = entry.lines.reduce((s: number, l: { debit: number }) => s + l.debit, 0);
    const totalCredit = entry.lines.reduce((s: number, l: { credit: number }) => s + l.credit, 0);
    expect(totalDebit).toBe(purchase.total_amount);
    expect(totalDebit).toBe(totalCredit);
  });

  it('lists supplier payments filtered by supplier', async () => {
    const listSupplier = await createSupplier(ctx.token, { name: 'List Supplier' });
    const purchase = await createPurchase(ctx.token, {
      branchId: ctx.user.branchId!,
      supplierId: listSupplier,
      productId,
      quantity: 1,
      unitPrice: 12000,
      taxRate: 0,
    });

    await request(app)
      .post('/api/v1/supplier-payments')
      .set('Authorization', bearer(ctx.token))
      .send({
        supplier_id: listSupplier,
        amount: purchase.total_amount,
        payment_mode: 'upi',
        reference_number: 'UPI123',
        allocations: [{
          purchase_id: purchase.id,
          allocated_amount: purchase.total_amount,
        }],
      })
      .expect(201);

    const list = await request(app)
      .get('/api/v1/supplier-payments')
      .set('Authorization', bearer(ctx.token))
      .query({ supplier_id: listSupplier })
      .expect(200);

    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    expect(list.body.data.every((p: { supplier_id: string }) => p.supplier_id === listSupplier)).toBe(true);
  });
});

describe('AP: multi-purchase payable tracking', () => {
  let ctx: AuthContext;
  let supplierId: string;
  let productId: string;

  beforeAll(async () => {
    ctx = await registerAndLogin();
    supplierId = await createSupplier(ctx.token, { name: 'Multi Purchase Supplier' });
    productId = await createProduct(ctx.token);
  });

  it('tracks cumulative payable across multiple purchases and partial payments', async () => {
    const p1 = await createPurchase(ctx.token, {
      branchId: ctx.user.branchId!,
      supplierId,
      productId,
      quantity: 1,
      unitPrice: 100000,
      taxRate: 0,
      paidAmount: 0,
    });
    const p2 = await createPurchase(ctx.token, {
      branchId: ctx.user.branchId!,
      supplierId,
      productId,
      quantity: 1,
      unitPrice: 50000,
      taxRate: 0,
      paidAmount: 0,
    });

    const totalDue = p1.total_amount + p2.total_amount;

    let balance = await request(app)
      .get(`/api/v1/suppliers/${supplierId}/balance`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);
    expect(balance.body.data.computed_balance).toBe(totalDue);

    await request(app)
      .post('/api/v1/supplier-payments')
      .set('Authorization', bearer(ctx.token))
      .send({
        supplier_id: supplierId,
        amount: p1.total_amount,
        payment_mode: 'cash',
        allocations: [{ purchase_id: p1.id, allocated_amount: p1.total_amount }],
      })
      .expect(201);

    balance = await request(app)
      .get(`/api/v1/suppliers/${supplierId}/balance`)
      .set('Authorization', bearer(ctx.token))
      .expect(200);

    expect(balance.body.data.computed_balance).toBe(p2.total_amount);
    expect(balance.body.data.cached_balance).toBe(p2.total_amount);
    expect(balance.body.data.is_consistent).toBe(true);
  });
});
