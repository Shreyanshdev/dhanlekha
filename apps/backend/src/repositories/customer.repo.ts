import { Knex } from 'knex';
import db from '../config/database';
import { BaseRepository } from './base.repo';
import type { Customer, CustomerLedger, LedgerSnapshot } from '@dhanlekha/shared';

export class CustomerRepository extends BaseRepository<Customer> {
  constructor(tenantId: string, trx?: Knex.Transaction) {
    super(tenantId, 'customers', trx);
  }

  // ─── Customer Profile Operations ──────────────────────────

  async findByPhone(phone: string): Promise<Customer | undefined> {
    return await this.getQuery().where({ phone }).first();
  }

  async search(query: string): Promise<Customer[]> {
    return await this.getQuery()
      .where((builder) => {
        builder.where('name', 'like', `%${query}%`)
               .orWhere('phone', 'like', `%${query}%`);
      })
      .orderBy('name', 'asc');
  }

  /**
   * Update the running balance (total_due) cache
   */
  async updateBalance(customerId: string, amount: number): Promise<void> {
    await this.getQuery().where({ id: customerId }).increment('total_due', amount);
  }

  // ─── Customer Ledger Operations ────────────────────────────

  /**
   * Get the latest ledger entry for a customer to determine running balance.
   * Locked with FOR UPDATE during transactions.
   */
  async getLatestLedgerEntry(customerId: string): Promise<CustomerLedger | undefined> {
    return await (this.trx ? this.trx('customer_ledger') : db('customer_ledger'))
      .where({ tenant_id: this.tenantId, customer_id: customerId })
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .forUpdate()
      .first();
  }

  /**
   * Add a new entry to the customer ledger
   */
  async addLedgerEntry(entry: Partial<CustomerLedger>): Promise<void> {
    await (this.trx ? this.trx('customer_ledger') : db('customer_ledger')).insert({
      ...entry,
      tenant_id: this.tenantId,
    });
  }

  /**
   * Get full financial history for a customer
   */
  async getLedgerHistory(customerId: string, limit: number = 50): Promise<CustomerLedger[]> {
    return await (this.trx ? this.trx('customer_ledger') : db('customer_ledger'))
      .where({ tenant_id: this.tenantId, customer_id: customerId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  // ─── Sprint 8: Paginated Ledger ─────────────────────────────

  /**
   * Paginated ledger entries with optional date filters.
   */
  async getLedgerPaged(
    customerId: string,
    page: number,
    limit: number,
    filters: { from?: string; to?: string; entry_type?: string } = {}
  ): Promise<{ items: CustomerLedger[]; total: number }> {
    const qb = (this.trx ? this.trx('customer_ledger') : db('customer_ledger'))
      .where({ tenant_id: this.tenantId, customer_id: customerId });

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
    const total = Number((countRow as any)?.count ?? 0);

    return { items: items as CustomerLedger[], total };
  }

  // ─── Sprint 8: Balance Summary ──────────────────────────────

  /**
   * Returns computed balance summary for a customer:
   * - total_debit, total_credit, computed_balance
   * - current total_due (cached on customer row)
   * - integrity check (computed === cached)
   */
  async getBalanceSummary(customerId: string): Promise<{
    total_debit: number;
    total_credit: number;
    computed_balance: number;
    cached_balance: number;
    is_consistent: boolean;
    entry_count: number;
    latest_entry_at: string | null;
  }> {
    const qb = this.trx ? this.trx('customer_ledger') : db('customer_ledger');

    const agg = await qb
      .where({ tenant_id: this.tenantId, customer_id: customerId })
      .select(
        db.raw('COALESCE(SUM(debit), 0) as total_debit'),
        db.raw('COALESCE(SUM(credit), 0) as total_credit'),
        db.raw('COUNT(id) as entry_count'),
        db.raw('MAX(created_at) as latest_entry_at')
      )
      .first() as any;

    const totalDebit = Number(agg?.total_debit ?? 0);
    const totalCredit = Number(agg?.total_credit ?? 0);
    const computedBalance = totalDebit - totalCredit;

    const customer = await this.getQuery().where({ id: customerId }).first();
    const cachedBalance = Number(customer?.total_due ?? 0);

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

  // ─── Sprint 8: Ledger Snapshots ─────────────────────────────

  /**
   * Create or update a daily snapshot for a customer.
   */
  async upsertSnapshot(snapshot: Omit<LedgerSnapshot, 'created_at'>): Promise<void> {
    const qb = this.trx ? this.trx('ledger_snapshots') : db('ledger_snapshots');

    // Try update first
    const updated = await qb
      .where({
        tenant_id: this.tenantId,
        customer_id: snapshot.customer_id,
        snapshot_date: snapshot.snapshot_date,
      })
      .update({
        closing_balance: snapshot.closing_balance,
        total_debit: snapshot.total_debit,
        total_credit: snapshot.total_credit,
        entry_count: snapshot.entry_count,
      });

    if (!updated) {
      await (this.trx ? this.trx('ledger_snapshots') : db('ledger_snapshots')).insert({
        ...snapshot,
        tenant_id: this.tenantId,
      });
    }
  }

  /**
   * Get snapshots for a customer within a date range.
   */
  async getSnapshots(
    customerId: string,
    from?: string,
    to?: string
  ): Promise<LedgerSnapshot[]> {
    const qb = (this.trx ? this.trx('ledger_snapshots') : db('ledger_snapshots'))
      .where({ tenant_id: this.tenantId, customer_id: customerId });

    if (from) qb.where('snapshot_date', '>=', from);
    if (to) qb.where('snapshot_date', '<=', to);

    return await qb.orderBy('snapshot_date', 'desc') as LedgerSnapshot[];
  }
}

