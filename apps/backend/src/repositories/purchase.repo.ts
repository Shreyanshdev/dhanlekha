import { BaseRepository } from './base.repo';
import db from '../config/database';
import type { Purchase, PurchaseItem, PurchasePaymentStatus } from '@dhanlekha/shared';

export class PurchaseRepository extends BaseRepository<Purchase> {
  constructor(tenantId: string, trx?: any) {
    super(tenantId, 'purchases', trx);
  }

  async findById(id: string): Promise<Purchase | undefined> {
    return await this.getQuery().where({ id }).first();
  }

  async create(purchase: Purchase): Promise<void> {
    await this.getQuery().insert(purchase);
  }

  async addItems(items: PurchaseItem[]): Promise<void> {
    const qb = this.trx ? this.trx('purchase_items') : db('purchase_items');
    await qb.insert(items.map(item => ({ ...item, tenant_id: this.tenantId })));
  }

  async getItems(purchaseId: string): Promise<PurchaseItem[]> {
    const qb = this.trx ? this.trx('purchase_items') : db('purchase_items');
    return await qb.where({ tenant_id: this.tenantId, purchase_id: purchaseId });
  }

  /** Update paid_amount and payment_status after a supplier payment allocation. */
  async updatePaymentStatus(
    purchaseId: string,
    paidAmount: number,
    paymentStatus: PurchasePaymentStatus
  ): Promise<void> {
    const qb = this.trx ? this.trx('purchases') : db('purchases');
    await qb
      .where({ id: purchaseId, tenant_id: this.tenantId })
      .update({
        paid_amount: paidAmount,
        payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      });
  }

  async listPaged(
    page: number,
    limit: number,
    filters: { branch_id?: string; supplier_id?: string; from?: string; to?: string } = {}
  ): Promise<{ items: Purchase[]; total: number }> {
    const query = this.getQuery()
      .where(builder => {
        if (filters.branch_id) builder.where('branch_id', filters.branch_id);
        if (filters.supplier_id) builder.where('supplier_id', filters.supplier_id);
        if (filters.from) builder.where('purchase_date', '>=', filters.from);
        if (filters.to) builder.where('purchase_date', '<=', filters.to);
      })
      .orderBy('created_at', 'desc');

    const totalQuery = query.clone().clearSelect().clearOrder().count('id as count').first() as any;
    const itemsQuery = query.clone().offset((page - 1) * limit).limit(limit);

    const [totalRes, items] = await Promise.all([totalQuery, itemsQuery]);
    return {
      items,
      total: Number(totalRes?.count ?? 0),
    };
  }
}
