import { v4 as uuidv4 } from 'uuid';
import { PaymentRepository, PaymentAllocationRepository } from '../../repositories/payment.repo';
import { InvoiceRepository } from '../../repositories/invoice.repo';
import { CustomerRepository } from '../../repositories/customer.repo';
import { withTransaction } from '../../database/transaction';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { postJournal } from '../../accounting/ledger.service';
import { settlementAccountForMode, ACCOUNTS } from '../../accounting/coa';
import type { Payment, PaymentAllocation } from '@dhanlekha/shared';
import type { CreatePaymentInput, AllocatePaymentInput } from './payments.validator';

// ── Helpers ──────────────────────────────────────────────────────────

/** Derive payment status from unallocated_amount vs total amount */
function deriveStatus(amount: number, unallocated: number): Payment['status'] {
  if (unallocated <= 0) return 'fully_allocated';
  if (unallocated < amount) return 'partially_allocated';
  return 'received';
}

/** Derive invoice status from amount_due */
function deriveInvoiceStatus(amountDue: number): 'paid' | 'partial' | 'unpaid' {
  if (amountDue <= 0) return 'paid';
  return 'partial';
}

/** Today's date in YYYY-MM-DD (local) */
function todayISO(): string {
  return new Date().toISOString().substring(0, 10);
}

// ── Service Functions ─────────────────────────────────────────────────

/**
 * Record a payment and optionally allocate it to invoices atomically.
 *
 * Atomic Workflow:
 *  1. Validate customer exists (if provided)
 *  2. Validate all invoices exist and belong to the same customer
 *  3. Validate allocated amounts don't exceed invoice dues or payment amount
 *  4. INSERT payment (unallocated_amount = amount initially)
 *  5. For each allocation: INSERT payment_allocation, UPDATE invoice (amount_paid, amount_due, status)
 *  6. UPDATE payment (unallocated_amount, status)
 *  7. INSERT customer_ledger entry (credit = total allocated)
 *  8. UPDATE customers.total_due -= total allocated
 */
export async function createPayment(
  tenantId: string,
  branchId: string,
  userId: string,
  data: CreatePaymentInput
): Promise<Payment & { allocations: PaymentAllocation[] }> {
  return await withTransaction(async (trx) => {
    const paymentRepo = new PaymentRepository(tenantId, branchId, trx);
    const allocationRepo = new PaymentAllocationRepository(tenantId, trx);
    const invoiceRepo = new InvoiceRepository(tenantId, branchId, trx);
    const customerRepo = new CustomerRepository(tenantId, trx);

    const paymentId = uuidv4();
    const paymentDate = data.payment_date ?? todayISO();
    const allocations = data.allocations ?? [];

    // ── Step 1: Validate customer ──────────────────────────────────────
    if (data.customer_id) {
      const customer = await customerRepo.findById(data.customer_id);
      if (!customer) throw new NotFoundError('Customer');
    }

    // ── Step 2 & 3: Validate invoices and amounts ─────────────────────
    let totalAllocated = 0;

    const invoiceUpdates: {
      invoiceId: string;
      newAmountPaid: number;
      newAmountDue: number;
    }[] = [];

    for (const alloc of allocations) {
      const invoice = await invoiceRepo.findIncludingDeleted(alloc.invoice_id);
      if (!invoice) throw new NotFoundError(`Invoice ${alloc.invoice_id}`);

      if (invoice.status === 'cancelled') {
        throw new BadRequestError(`Cannot allocate payment to a cancelled invoice (${invoice.invoice_number})`);
      }
      if (invoice.status === 'paid') {
        throw new BadRequestError(`Invoice ${invoice.invoice_number} is already fully paid`);
      }
      if (data.customer_id && invoice.customer_id !== data.customer_id) {
        throw new BadRequestError(`Invoice ${invoice.invoice_number} does not belong to this customer`);
      }
      if (alloc.allocated_amount > Number(invoice.amount_due)) {
        throw new BadRequestError(
          `Allocated amount (₹${alloc.allocated_amount / 100}) exceeds the outstanding due on invoice ${invoice.invoice_number} (₹${Number(invoice.amount_due) / 100})`
        );
      }

      totalAllocated += alloc.allocated_amount;
      invoiceUpdates.push({
        invoiceId: invoice.id,
        newAmountPaid: Number(invoice.amount_paid) + alloc.allocated_amount,
        newAmountDue: Number(invoice.amount_due) - alloc.allocated_amount,
      });
    }

    if (totalAllocated > data.amount) {
      throw new BadRequestError(
        `Total allocated (₹${totalAllocated / 100}) exceeds the payment amount (₹${data.amount / 100})`
      );
    }

    const unallocated = data.amount - totalAllocated;

    // ── Step 4: INSERT payment ─────────────────────────────────────────
    await paymentRepo.create({
      id: paymentId,
      tenant_id: tenantId,
      branch_id: branchId,
      customer_id: data.customer_id ?? null,
      created_by: userId,
      amount: data.amount,
      unallocated_amount: unallocated,
      payment_mode: data.payment_mode,
      status: deriveStatus(data.amount, unallocated),
      reference_number: data.reference_number ?? null,
      note: data.note ?? null,
      payment_date: paymentDate,
      is_deleted: false,
    });

    // ── Step 5: INSERT allocations & UPDATE invoices ───────────────────
    const createdAllocations: PaymentAllocation[] = [];

    for (let i = 0; i < allocations.length; i++) {
      const alloc = allocations[i];
      const update = invoiceUpdates[i];
      const allocationId = uuidv4();

      // INSERT payment_allocation
      await allocationRepo.create({
        id: allocationId,
        tenant_id: tenantId,
        payment_id: paymentId,
        invoice_id: alloc.invoice_id,
        allocated_amount: alloc.allocated_amount,
      });

      createdAllocations.push({
        id: allocationId,
        tenant_id: tenantId,
        payment_id: paymentId,
        invoice_id: alloc.invoice_id,
        allocated_amount: alloc.allocated_amount,
        created_at: new Date().toISOString(),
      });

      // UPDATE invoice (amount_paid, amount_due, status)
      const qb = trx('invoices');
      await qb.where({ id: update.invoiceId, tenant_id: tenantId }).update({
        amount_paid: update.newAmountPaid,
        amount_due: update.newAmountDue,
        status: deriveInvoiceStatus(update.newAmountDue),
        updated_at: new Date().toISOString(),
      });
    }

    // ── Step 7 & 8: Ledger + Customer balance update ──────────────────
    if (data.customer_id && totalAllocated > 0) {
      const latestEntry = await customerRepo.getLatestLedgerEntry(data.customer_id);
      const currentBalance = latestEntry
        ? Number(latestEntry.running_balance)
        : Number((await customerRepo.findById(data.customer_id))?.total_due ?? 0);

      const newBalance = currentBalance - totalAllocated;

      await customerRepo.addLedgerEntry({
        id: uuidv4(),
        tenant_id: tenantId,
        customer_id: data.customer_id,
        entry_type: 'payment',
        reference_id: paymentId,
        debit: 0,
        credit: totalAllocated,
        running_balance: newBalance,
      });

      // Reduce outstanding balance
      await customerRepo.updateBalance(data.customer_id, -totalAllocated);
    }

    // Post the GL entry: Dr Cash/Bank, Cr Accounts Receivable (Sprint 18).
    if (data.amount > 0) {
      await postJournal(trx, {
        tenantId,
        branchId,
        entryDate: paymentDate,
        narration: `Payment received${data.reference_number ? ` (${data.reference_number})` : ''}`,
        referenceType: 'payment',
        referenceId: paymentId,
        createdBy: userId,
        lines: [
          { account_code: settlementAccountForMode(data.payment_mode), debit: data.amount },
          { account_code: ACCOUNTS.ACCOUNTS_RECEIVABLE, credit: data.amount },
        ],
      });
    }

    const payment = (await paymentRepo.findById(paymentId))!;
    return { ...payment, allocations: createdAllocations };
  });
}

/**
 * Allocate an existing unallocated payment to invoices.
 * Used when a customer pays in advance and invoices are generated later.
 */
export async function allocatePayment(
  tenantId: string,
  branchId: string,
  userId: string,
  paymentId: string,
  data: AllocatePaymentInput
): Promise<Payment & { allocations: PaymentAllocation[] }> {
  return await withTransaction(async (trx) => {
    const paymentRepo = new PaymentRepository(tenantId, branchId, trx);
    const allocationRepo = new PaymentAllocationRepository(tenantId, trx);
    const invoiceRepo = new InvoiceRepository(tenantId, branchId, trx);
    const customerRepo = new CustomerRepository(tenantId, trx);

    const payment = await paymentRepo.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment');
    if (payment.is_deleted) throw new BadRequestError('Payment has been deleted');

    let totalNewAllocation = 0;
    const invoiceUpdates: {
      invoiceId: string;
      newAmountPaid: number;
      newAmountDue: number;
    }[] = [];

    // Validate invoices and check no duplicate allocations
    for (const alloc of data.allocations) {
      const invoice = await invoiceRepo.findById(alloc.invoice_id);
      if (!invoice) throw new NotFoundError(`Invoice ${alloc.invoice_id}`);

      if (invoice.status === 'cancelled')
        throw new BadRequestError(`Cannot allocate to a cancelled invoice (${invoice.invoice_number})`);
      if (invoice.status === 'paid')
        throw new BadRequestError(`Invoice ${invoice.invoice_number} is already fully paid`);

      // Check if already allocated from this payment
      const existingAlloc = await allocationRepo.getQuery()
        .where({ payment_id: paymentId, invoice_id: alloc.invoice_id })
        .first();
      if (existingAlloc) {
        throw new BadRequestError(
          `Payment is already allocated to invoice ${invoice.invoice_number}. Use a new payment for additional amounts.`
        );
      }

      if (alloc.allocated_amount > Number(invoice.amount_due)) {
        throw new BadRequestError(
          `Allocated amount exceeds outstanding due on invoice ${invoice.invoice_number}`
        );
      }

      totalNewAllocation += alloc.allocated_amount;
      invoiceUpdates.push({
        invoiceId: invoice.id,
        newAmountPaid: Number(invoice.amount_paid) + alloc.allocated_amount,
        newAmountDue: Number(invoice.amount_due) - alloc.allocated_amount,
      });
    }

    if (totalNewAllocation > Number(payment.unallocated_amount)) {
      throw new BadRequestError(
        `Total allocation (₹${totalNewAllocation / 100}) exceeds unallocated balance (₹${Number(payment.unallocated_amount) / 100})`
      );
    }

    const newUnallocated = Number(payment.unallocated_amount) - totalNewAllocation;

    // INSERT allocations + UPDATE invoices
    const createdAllocations: PaymentAllocation[] = [];

    for (let i = 0; i < data.allocations.length; i++) {
      const alloc = data.allocations[i];
      const update = invoiceUpdates[i];
      const allocationId = uuidv4();

      await allocationRepo.create({
        id: allocationId,
        tenant_id: tenantId,
        payment_id: paymentId,
        invoice_id: alloc.invoice_id,
        allocated_amount: alloc.allocated_amount,
      });

      createdAllocations.push({
        id: allocationId,
        tenant_id: tenantId,
        payment_id: paymentId,
        invoice_id: alloc.invoice_id,
        allocated_amount: alloc.allocated_amount,
        created_at: new Date().toISOString(),
      });

      await trx('invoices').where({ id: update.invoiceId, tenant_id: tenantId }).update({
        amount_paid: update.newAmountPaid,
        amount_due: update.newAmountDue,
        status: deriveInvoiceStatus(update.newAmountDue),
        updated_at: new Date().toISOString(),
      });
    }

    // UPDATE payment unallocated + status
    await paymentRepo.updateAllocation(
      paymentId,
      newUnallocated,
      deriveStatus(Number(payment.amount), newUnallocated)
    );

    // Ledger + customer balance
    if (payment.customer_id && totalNewAllocation > 0) {
      const latestEntry = await customerRepo.getLatestLedgerEntry(payment.customer_id);
      const currentBalance = latestEntry
        ? Number(latestEntry.running_balance)
        : Number((await customerRepo.findById(payment.customer_id))?.total_due ?? 0);

      await customerRepo.addLedgerEntry({
        id: uuidv4(),
        tenant_id: tenantId,
        customer_id: payment.customer_id,
        entry_type: 'payment',
        reference_id: paymentId,
        debit: 0,
        credit: totalNewAllocation,
        running_balance: currentBalance - totalNewAllocation,
      });

      await customerRepo.updateBalance(payment.customer_id, -totalNewAllocation);
    }

    const updatedPayment = (await paymentRepo.findById(paymentId))!;
    const allAllocations = await allocationRepo.findByPaymentId(paymentId);
    return { ...updatedPayment, allocations: allAllocations };
  });
}

/**
 * Get a single payment with its allocations.
 */
export async function getPaymentById(
  tenantId: string,
  branchId: string,
  paymentId: string
): Promise<Payment & { allocations: PaymentAllocation[] }> {
  const paymentRepo = new PaymentRepository(tenantId, branchId);
  const allocationRepo = new PaymentAllocationRepository(tenantId);

  const payment = await paymentRepo.findById(paymentId);
  if (!payment) throw new NotFoundError('Payment');

  const allocations = await allocationRepo.findByPaymentId(paymentId);
  return { ...payment, allocations };
}

/**
 * List payments (paginated + filtered).
 */
export async function listPayments(
  tenantId: string,
  branchId: string,
  page: number,
  limit: number,
  filters: { customer_id?: string; status?: string; payment_mode?: string }
): Promise<{ items: (Payment & { allocations: PaymentAllocation[] })[]; total: number }> {
  const paymentRepo = new PaymentRepository(tenantId, branchId);
  const allocationRepo = new PaymentAllocationRepository(tenantId);

  const { items, total } = await paymentRepo.listPaged(page, limit, filters);

  // Batch-fetch all allocations for the returned payments
  const paymentIds = items.map(p => p.id);
  const allAllocations = paymentIds.length > 0
    ? await allocationRepo.getQuery().whereIn('payment_id', paymentIds)
    : [];

  const allocationsByPayment = new Map<string, PaymentAllocation[]>();
  for (const alloc of allAllocations as PaymentAllocation[]) {
    const existing = allocationsByPayment.get(alloc.payment_id) ?? [];
    existing.push(alloc);
    allocationsByPayment.set(alloc.payment_id, existing);
  }

  return {
    items: items.map(p => ({ ...p, allocations: allocationsByPayment.get(p.id) ?? [] })),
    total,
  };
}
