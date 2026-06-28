import { v4 as uuidv4 } from 'uuid';
import {
  SupplierPaymentRepository,
  SupplierPaymentAllocationRepository,
} from '../../repositories/supplier-payment.repo';
import { PurchaseRepository } from '../../repositories/purchase.repo';
import { SupplierRepository } from '../../repositories/supplier.repo';
import { withTransaction } from '../../database/transaction';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { postJournal } from '../../accounting/ledger.service';
import { settlementAccountForMode, ACCOUNTS } from '../../accounting/coa';
import type { SupplierPayment, SupplierPaymentAllocation } from '@dhanlekha/shared';
import type {
  CreateSupplierPaymentInput,
  AllocateSupplierPaymentInput,
} from './supplier-payments.validator';

function deriveStatus(amount: number, unallocated: number): SupplierPayment['status'] {
  if (unallocated <= 0) return 'fully_allocated';
  if (unallocated < amount) return 'partially_allocated';
  return 'received';
}

function derivePurchasePaymentStatus(
  totalAmount: number,
  paidAmount: number
): 'paid' | 'partial' | 'unpaid' {
  if (paidAmount >= totalAmount) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

function purchaseAmountDue(purchase: { total_amount: number; paid_amount: number }): number {
  return Number(purchase.total_amount) - Number(purchase.paid_amount);
}

function todayISO(): string {
  return new Date().toISOString().substring(0, 10);
}

/**
 * Record a supplier payment and optionally allocate it to purchases atomically.
 */
export async function createSupplierPayment(
  tenantId: string,
  branchId: string,
  userId: string,
  data: CreateSupplierPaymentInput
): Promise<SupplierPayment & { allocations: SupplierPaymentAllocation[] }> {
  return await withTransaction(async (trx) => {
    const paymentRepo = new SupplierPaymentRepository(tenantId, branchId, trx);
    const allocationRepo = new SupplierPaymentAllocationRepository(tenantId, trx);
    const purchaseRepo = new PurchaseRepository(tenantId, trx);
    const supplierRepo = new SupplierRepository(tenantId, trx);

    const paymentId = uuidv4();
    const paymentDate = data.payment_date ?? todayISO();
    const allocations = data.allocations ?? [];

    const supplier = await supplierRepo.findById(data.supplier_id);
    if (!supplier) throw new NotFoundError('Supplier');

    let totalAllocated = 0;
    const purchaseUpdates: {
      purchaseId: string;
      newPaidAmount: number;
      paymentStatus: 'paid' | 'partial' | 'unpaid';
    }[] = [];

    for (const alloc of allocations) {
      const purchase = await purchaseRepo.findById(alloc.purchase_id);
      if (!purchase) throw new NotFoundError(`Purchase ${alloc.purchase_id}`);

      if (purchase.status === 'cancelled') {
        throw new BadRequestError(
          `Cannot allocate payment to a cancelled purchase (${purchase.purchase_number})`
        );
      }
      if (purchase.payment_status === 'paid') {
        throw new BadRequestError(`Purchase ${purchase.purchase_number} is already fully paid`);
      }
      if (purchase.supplier_id !== data.supplier_id) {
        throw new BadRequestError(
          `Purchase ${purchase.purchase_number} does not belong to this supplier`
        );
      }

      const amountDue = purchaseAmountDue(purchase);
      if (alloc.allocated_amount > amountDue) {
        throw new BadRequestError(
          `Allocated amount exceeds the outstanding due on purchase ${purchase.purchase_number}`
        );
      }

      totalAllocated += alloc.allocated_amount;
      purchaseUpdates.push({
        purchaseId: purchase.id,
        newPaidAmount: Number(purchase.paid_amount) + alloc.allocated_amount,
        paymentStatus: derivePurchasePaymentStatus(
          Number(purchase.total_amount),
          Number(purchase.paid_amount) + alloc.allocated_amount
        ),
      });
    }

    if (totalAllocated > data.amount) {
      throw new BadRequestError(
        `Total allocated exceeds the payment amount`
      );
    }

    const unallocated = data.amount - totalAllocated;

    await paymentRepo.create({
      id: paymentId,
      tenant_id: tenantId,
      branch_id: branchId,
      supplier_id: data.supplier_id,
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

    const createdAllocations: SupplierPaymentAllocation[] = [];

    for (let i = 0; i < allocations.length; i++) {
      const alloc = allocations[i];
      const update = purchaseUpdates[i];
      const allocationId = uuidv4();

      await allocationRepo.create({
        id: allocationId,
        tenant_id: tenantId,
        supplier_payment_id: paymentId,
        purchase_id: alloc.purchase_id,
        allocated_amount: alloc.allocated_amount,
      });

      createdAllocations.push({
        id: allocationId,
        tenant_id: tenantId,
        supplier_payment_id: paymentId,
        purchase_id: alloc.purchase_id,
        allocated_amount: alloc.allocated_amount,
        created_at: new Date().toISOString(),
      });

      await purchaseRepo.updatePaymentStatus(
        update.purchaseId,
        update.newPaidAmount,
        update.paymentStatus
      );
    }

    if (totalAllocated > 0) {
      const latestEntry = await supplierRepo.getLatestLedgerEntry(data.supplier_id);
      const currentBalance = latestEntry
        ? Number(latestEntry.running_balance)
        : Number(supplier.total_payable ?? 0);

      await supplierRepo.addLedgerEntry({
        id: uuidv4(),
        tenant_id: tenantId,
        supplier_id: data.supplier_id,
        entry_type: 'payment',
        reference_id: paymentId,
        debit: 0,
        credit: totalAllocated,
        running_balance: currentBalance - totalAllocated,
        created_by: userId,
      });

      await supplierRepo.updatePayable(data.supplier_id, -totalAllocated);
    }

    if (data.amount > 0) {
      await postJournal(trx, {
        tenantId,
        branchId,
        entryDate: paymentDate,
        narration: `Supplier payment${data.reference_number ? ` (${data.reference_number})` : ''}`,
        referenceType: 'supplier_payment',
        referenceId: paymentId,
        createdBy: userId,
        lines: [
          { account_code: ACCOUNTS.ACCOUNTS_PAYABLE, debit: data.amount },
          { account_code: settlementAccountForMode(data.payment_mode), credit: data.amount },
        ],
      });
    }

    const payment = (await paymentRepo.findById(paymentId))!;
    return { ...payment, allocations: createdAllocations };
  });
}

export async function allocateSupplierPayment(
  tenantId: string,
  branchId: string,
  userId: string,
  paymentId: string,
  data: AllocateSupplierPaymentInput
): Promise<SupplierPayment & { allocations: SupplierPaymentAllocation[] }> {
  return await withTransaction(async (trx) => {
    const paymentRepo = new SupplierPaymentRepository(tenantId, branchId, trx);
    const allocationRepo = new SupplierPaymentAllocationRepository(tenantId, trx);
    const purchaseRepo = new PurchaseRepository(tenantId, trx);
    const supplierRepo = new SupplierRepository(tenantId, trx);

    const payment = await paymentRepo.findById(paymentId);
    if (!payment) throw new NotFoundError('Supplier payment');
    if (payment.is_deleted) throw new BadRequestError('Supplier payment has been deleted');

    let totalNewAllocation = 0;
    const purchaseUpdates: {
      purchaseId: string;
      newPaidAmount: number;
      paymentStatus: 'paid' | 'partial' | 'unpaid';
    }[] = [];

    for (const alloc of data.allocations) {
      const purchase = await purchaseRepo.findById(alloc.purchase_id);
      if (!purchase) throw new NotFoundError(`Purchase ${alloc.purchase_id}`);

      if (purchase.status === 'cancelled') {
        throw new BadRequestError(`Cannot allocate to a cancelled purchase (${purchase.purchase_number})`);
      }
      if (purchase.payment_status === 'paid') {
        throw new BadRequestError(`Purchase ${purchase.purchase_number} is already fully paid`);
      }
      if (purchase.supplier_id !== payment.supplier_id) {
        throw new BadRequestError(
          `Purchase ${purchase.purchase_number} does not belong to this supplier`
        );
      }

      const existingAlloc = await allocationRepo.getQuery()
        .where({ supplier_payment_id: paymentId, purchase_id: alloc.purchase_id })
        .first();
      if (existingAlloc) {
        throw new BadRequestError(
          `Payment is already allocated to purchase ${purchase.purchase_number}`
        );
      }

      const amountDue = purchaseAmountDue(purchase);
      if (alloc.allocated_amount > amountDue) {
        throw new BadRequestError(
          `Allocated amount exceeds outstanding due on purchase ${purchase.purchase_number}`
        );
      }

      totalNewAllocation += alloc.allocated_amount;
      purchaseUpdates.push({
        purchaseId: purchase.id,
        newPaidAmount: Number(purchase.paid_amount) + alloc.allocated_amount,
        paymentStatus: derivePurchasePaymentStatus(
          Number(purchase.total_amount),
          Number(purchase.paid_amount) + alloc.allocated_amount
        ),
      });
    }

    if (totalNewAllocation > Number(payment.unallocated_amount)) {
      throw new BadRequestError('Total allocation exceeds unallocated balance');
    }

    const newUnallocated = Number(payment.unallocated_amount) - totalNewAllocation;

    for (let i = 0; i < data.allocations.length; i++) {
      const alloc = data.allocations[i];
      const update = purchaseUpdates[i];
      const allocationId = uuidv4();

      await allocationRepo.create({
        id: allocationId,
        tenant_id: tenantId,
        supplier_payment_id: paymentId,
        purchase_id: alloc.purchase_id,
        allocated_amount: alloc.allocated_amount,
      });

      await purchaseRepo.updatePaymentStatus(
        update.purchaseId,
        update.newPaidAmount,
        update.paymentStatus
      );
    }

    await paymentRepo.updateAllocation(
      paymentId,
      newUnallocated,
      deriveStatus(Number(payment.amount), newUnallocated)
    );

    if (totalNewAllocation > 0) {
      const latestEntry = await supplierRepo.getLatestLedgerEntry(payment.supplier_id);
      const currentBalance = latestEntry
        ? Number(latestEntry.running_balance)
        : Number((await supplierRepo.findById(payment.supplier_id))?.total_payable ?? 0);

      await supplierRepo.addLedgerEntry({
        id: uuidv4(),
        tenant_id: tenantId,
        supplier_id: payment.supplier_id,
        entry_type: 'payment',
        reference_id: paymentId,
        debit: 0,
        credit: totalNewAllocation,
        running_balance: currentBalance - totalNewAllocation,
        created_by: userId,
      });

      await supplierRepo.updatePayable(payment.supplier_id, -totalNewAllocation);
    }

    const updatedPayment = (await paymentRepo.findById(paymentId))!;
    const allAllocations = await allocationRepo.findByPaymentId(paymentId);
    return { ...updatedPayment, allocations: allAllocations };
  });
}

export async function getSupplierPaymentById(
  tenantId: string,
  branchId: string,
  paymentId: string
): Promise<SupplierPayment & { allocations: SupplierPaymentAllocation[] }> {
  const paymentRepo = new SupplierPaymentRepository(tenantId, branchId);
  const allocationRepo = new SupplierPaymentAllocationRepository(tenantId);

  const payment = await paymentRepo.findById(paymentId);
  if (!payment) throw new NotFoundError('Supplier payment');

  const allocations = await allocationRepo.findByPaymentId(paymentId);
  return { ...payment, allocations };
}

export async function listSupplierPayments(
  tenantId: string,
  branchId: string,
  page: number,
  limit: number,
  filters: { supplier_id?: string; status?: string; payment_mode?: string }
): Promise<{ items: (SupplierPayment & { allocations: SupplierPaymentAllocation[] })[]; total: number }> {
  const paymentRepo = new SupplierPaymentRepository(tenantId, branchId);
  const allocationRepo = new SupplierPaymentAllocationRepository(tenantId);

  const { items, total } = await paymentRepo.listPaged(page, limit, filters);

  const paymentIds = items.map((p) => p.id);
  const allAllocations = paymentIds.length > 0
    ? await allocationRepo.getQuery().whereIn('supplier_payment_id', paymentIds)
    : [];

  const allocationsByPayment = new Map<string, SupplierPaymentAllocation[]>();
  for (const alloc of allAllocations as SupplierPaymentAllocation[]) {
    const existing = allocationsByPayment.get(alloc.supplier_payment_id) ?? [];
    existing.push(alloc);
    allocationsByPayment.set(alloc.supplier_payment_id, existing);
  }

  return {
    items: items.map((p) => ({
      ...p,
      allocations: allocationsByPayment.get(p.id) ?? [],
    })),
    total,
  };
}
