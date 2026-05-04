import { Knex } from 'knex';
import { BranchScopedRepository } from './base.repo';
import { BaseRepository } from './base.repo';
import db from '../config/database';
import type { Payment, PaymentAllocation } from '@dhanlekha/shared';

/**
 * PaymentRepository
 *
 * Handles payments table (branch-scoped, soft-delete).
 * Uses BranchScopedRepository so all queries are automatically isolated
 * by tenant_id + branch_id.
 */
export class PaymentRepository extends BranchScopedRepository<Payment> {
  constructor(tenantId: string, branchId: string, trx?: Knex.Transaction) {
    super(tenantId, branchId, 'payments', trx);
  }

  async findById(id: string): Promise<Payment | undefined> {
    return await this.getQuery().where({ id }).first();
  }

  async listPaged(
    page: number,
    limit: number,
    filters: { customer_id?: string; status?: string; payment_mode?: string } = {}
  ): Promise<{ items: Payment[]; total: number }> {
    const query = this.getQuery();

    if (filters.customer_id) query.where({ customer_id: filters.customer_id });
    if (filters.status) query.where({ status: filters.status });
    if (filters.payment_mode) query.where({ payment_mode: filters.payment_mode });

    const countQuery = query.clone().count('id as count').first();
    const itemsQuery = query
      .clone()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    const [countRow, items] = await Promise.all([countQuery, itemsQuery]);
    const total = Number((countRow as any)?.count ?? 0);

    return { items, total };
  }

  /**
   * Update unallocated_amount and status atomically.
   */
  async updateAllocation(
    paymentId: string,
    newUnallocated: number,
    newStatus: Payment['status']
  ): Promise<void> {
    const qb = this.trx ? this.trx('payments') : db('payments');
    await qb
      .where({ id: paymentId, tenant_id: this.tenantId })
      .update({ unallocated_amount: newUnallocated, status: newStatus, updated_at: new Date().toISOString() });
  }

  /**
   * Soft-delete a payment.
   */
  async softDelete(id: string): Promise<number> {
    const qb = this.trx ? this.trx('payments') : db('payments');
    return await qb
      .where({ id, tenant_id: this.tenantId })
      .update({ is_deleted: true, updated_at: new Date().toISOString() });
  }
}

/**
 * PaymentAllocationRepository
 *
 * Append-only — allocations are never updated or deleted (financial audit trail).
 */
export class PaymentAllocationRepository extends BaseRepository<PaymentAllocation> {
  constructor(tenantId: string, trx?: Knex.Transaction) {
    super(tenantId, 'payment_allocations', trx);
  }

  /** Override: payment_allocations has no is_deleted column */
  public getQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx(this.tableName) : db(this.tableName);
    return qb.where({ tenant_id: this.tenantId });
  }

  async findByPaymentId(paymentId: string): Promise<PaymentAllocation[]> {
    return await this.getQuery().where({ payment_id: paymentId });
  }

  async findByInvoiceId(invoiceId: string): Promise<PaymentAllocation[]> {
    return await this.getQuery().where({ invoice_id: invoiceId });
  }

  /**
   * Sum of all allocated amounts toward a given invoice.
   */
  async sumAllocatedForInvoice(invoiceId: string): Promise<number> {
    const row = await this.getQuery()
      .where({ invoice_id: invoiceId })
      .sum('allocated_amount as total')
      .first();
    return Number((row as any)?.total ?? 0);
  }

  /** Allocations are never updated/deleted — block these operations */
  async update(): Promise<never> {
    throw new Error('PaymentAllocations are append-only. They cannot be updated.');
  }
  async softDelete(): Promise<never> {
    throw new Error('PaymentAllocations are append-only. They cannot be deleted.');
  }
}
