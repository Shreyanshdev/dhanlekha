import type { Knex } from 'knex';
import { BranchScopedRepository } from './base.repo';
import { BaseRepository } from './base.repo';
import db from '../config/database';
import type { SupplierPayment, SupplierPaymentAllocation } from '@dhanlekha/shared';

export class SupplierPaymentRepository extends BranchScopedRepository<SupplierPayment> {
  constructor(tenantId: string, branchId: string, trx?: Knex.Transaction) {
    super(tenantId, branchId, 'supplier_payments', trx);
  }

  async findById(id: string): Promise<SupplierPayment | undefined> {
    return await this.getQuery().where({ id }).first();
  }

  async listPaged(
    page: number,
    limit: number,
    filters: { supplier_id?: string; status?: string; payment_mode?: string } = {}
  ): Promise<{ items: SupplierPayment[]; total: number }> {
    const query = this.getQuery();

    if (filters.supplier_id) query.where({ supplier_id: filters.supplier_id });
    if (filters.status) query.where({ status: filters.status });
    if (filters.payment_mode) query.where({ payment_mode: filters.payment_mode });

    const countQuery = query.clone().count('id as count').first();
    const itemsQuery = query
      .clone()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    const [countRow, items] = await Promise.all([countQuery, itemsQuery]);
    const total = Number((countRow as { count?: number | string })?.count ?? 0);

    return { items, total };
  }

  async updateAllocation(
    paymentId: string,
    newUnallocated: number,
    newStatus: SupplierPayment['status']
  ): Promise<void> {
    const qb = this.trx ? this.trx('supplier_payments') : db('supplier_payments');
    await qb
      .where({ id: paymentId, tenant_id: this.tenantId })
      .update({
        unallocated_amount: newUnallocated,
        status: newStatus,
        updated_at: new Date().toISOString(),
      });
  }
}

/** Append-only allocation rows linking supplier payments to purchases. */
export class SupplierPaymentAllocationRepository extends BaseRepository<SupplierPaymentAllocation> {
  constructor(tenantId: string, trx?: Knex.Transaction) {
    super(tenantId, 'supplier_payment_allocations', trx);
  }

  public getQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx(this.tableName) : db(this.tableName);
    return qb.where({ tenant_id: this.tenantId });
  }

  async findByPaymentId(paymentId: string): Promise<SupplierPaymentAllocation[]> {
    return await this.getQuery().where({ supplier_payment_id: paymentId });
  }

  async findByPurchaseId(purchaseId: string): Promise<SupplierPaymentAllocation[]> {
    return await this.getQuery().where({ purchase_id: purchaseId });
  }

  async update(): Promise<never> {
    throw new Error('SupplierPaymentAllocations are append-only. They cannot be updated.');
  }

  async softDelete(): Promise<never> {
    throw new Error('SupplierPaymentAllocations are append-only. They cannot be deleted.');
  }
}
