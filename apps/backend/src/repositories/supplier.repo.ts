import type { Knex } from 'knex';
import db from '../config/database';
import { BaseRepository } from './base.repo';
import type { Supplier, SupplierLedger } from '@dhanlekha/shared';

export class SupplierRepository extends BaseRepository<Supplier> {
  constructor(tenantId: string, trx?: Knex.Transaction) {
    super(tenantId, 'suppliers', trx);
  }

  async findByGst(gstNumber: string): Promise<Supplier | undefined> {
    return await this.getQuery().where({ gst_number: gstNumber }).first();
  }

  async search(query: string): Promise<Supplier[]> {
    return await this.getQuery()
      .where((builder) => {
        builder.where('name', 'like', `%${query}%`)
               .orWhere('phone', 'like', `%${query}%`);
      })
      .orderBy('name', 'asc');
  }

  /** Update the cached outstanding payable (total_payable). */
  async updatePayable(supplierId: string, amountDelta: number): Promise<void> {
    await this.getQuery().where({ id: supplierId }).increment('total_payable', amountDelta);
  }

  async getLatestLedgerEntry(supplierId: string): Promise<SupplierLedger | undefined> {
    return await (this.trx ? this.trx('supplier_ledger') : db('supplier_ledger'))
      .where({ tenant_id: this.tenantId, supplier_id: supplierId })
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .forUpdate()
      .first();
  }

  async addLedgerEntry(entry: Partial<SupplierLedger>): Promise<void> {
    await (this.trx ? this.trx('supplier_ledger') : db('supplier_ledger')).insert({
      ...entry,
      tenant_id: this.tenantId,
    });
  }

  async getLedgerPaged(
    supplierId: string,
    page: number,
    limit: number,
    filters: { from?: string; to?: string; entry_type?: string } = {}
  ): Promise<{ items: SupplierLedger[]; total: number }> {
    const qb = (this.trx ? this.trx('supplier_ledger') : db('supplier_ledger'))
      .where({ tenant_id: this.tenantId, supplier_id: supplierId });

    if (filters.from) qb.where('created_at', '>=', filters.from);
    if (filters.to) qb.where('created_at', '<=', `${filters.to}T23:59:59.999Z`);
    if (filters.entry_type) qb.where('entry_type', filters.entry_type);

    const countQuery = qb.clone().count('id as count').first();
    const itemsQuery = qb
      .clone()
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    const [countRow, items] = await Promise.all([countQuery, itemsQuery]);
    const total = Number((countRow as { count?: number | string })?.count ?? 0);

    return { items: items as SupplierLedger[], total };
  }

  async getBalanceSummary(supplierId: string): Promise<{
    total_debit: number;
    total_credit: number;
    computed_balance: number;
    cached_balance: number;
    is_consistent: boolean;
    entry_count: number;
    latest_entry_at: string | null;
  }> {
    const qb = this.trx ? this.trx('supplier_ledger') : db('supplier_ledger');

    const agg = await qb
      .where({ tenant_id: this.tenantId, supplier_id: supplierId })
      .select(
        db.raw('COALESCE(SUM(debit), 0) as total_debit'),
        db.raw('COALESCE(SUM(credit), 0) as total_credit'),
        db.raw('COUNT(id) as entry_count'),
        db.raw('MAX(created_at) as latest_entry_at')
      )
      .first() as {
        total_debit?: number | string;
        total_credit?: number | string;
        entry_count?: number | string;
        latest_entry_at?: string | null;
      } | undefined;

    const totalDebit = Number(agg?.total_debit ?? 0);
    const totalCredit = Number(agg?.total_credit ?? 0);
    const computedBalance = totalDebit - totalCredit;

    const supplier = await this.getQuery().where({ id: supplierId }).first();
    const cachedBalance = Number(supplier?.total_payable ?? 0);

    return {
      total_debit: totalDebit,
      total_credit: totalCredit,
      computed_balance: computedBalance,
      cached_balance: cachedBalance,
      is_consistent: computedBalance === cachedBalance,
      entry_count: Number(agg?.entry_count ?? 0),
      latest_entry_at: agg?.latest_entry_at ?? null,
    };
  }
}
