import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import type { FinancialYear, OpeningBalance } from '@dhanlekha/shared';

export class FinancialYearRepository {
  private tenantId: string;
  private trx?: Knex.Transaction;

  constructor(tenantId: string, trx?: Knex.Transaction) {
    this.tenantId = tenantId;
    this.trx = trx;
  }

  private table(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx('financial_years') : db('financial_years');
    return qb.where({ tenant_id: this.tenantId, is_deleted: false });
  }

  async findById(id: string): Promise<FinancialYear | undefined> {
    return await this.table().where({ id }).first();
  }

  async listAll(): Promise<FinancialYear[]> {
    return await this.table().orderBy('start_date', 'desc');
  }

  async create(row: Omit<FinancialYear, 'created_at' | 'updated_at'>): Promise<void> {
    const now = new Date().toISOString();
    const qb = this.trx ? this.trx('financial_years') : db('financial_years');
    await qb.insert({ ...row, created_at: now, updated_at: now });
  }

  async markClosed(id: string): Promise<void> {
    const qb = this.trx ? this.trx('financial_years') : db('financial_years');
    await qb
      .where({ id, tenant_id: this.tenantId })
      .update({ status: 'closed', updated_at: new Date().toISOString() });
  }

  /** True if [start,end] overlaps any existing non-deleted FY for the tenant. */
  async hasOverlap(startDate: string, endDate: string, excludeId?: string): Promise<boolean> {
    const q = this.table()
      .where('start_date', '<=', endDate)
      .where('end_date', '>=', startDate);
    if (excludeId) q.whereNot({ id: excludeId });
    const row = await q.count('id as count').first();
    return Number((row as { count?: number | string })?.count ?? 0) > 0;
  }
}

export class OpeningBalanceRepository {
  private tenantId: string;
  private trx?: Knex.Transaction;

  constructor(tenantId: string, trx?: Knex.Transaction) {
    this.tenantId = tenantId;
    this.trx = trx;
  }

  private table(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx('opening_balances') : db('opening_balances');
    return qb.where({ tenant_id: this.tenantId });
  }

  async listForYear(financialYearId: string): Promise<OpeningBalance[]> {
    return await this.table().where({ financial_year_id: financialYearId });
  }

  async replaceForYear(
    financialYearId: string,
    rows: Array<{ account_id: string; debit: number; credit: number }>
  ): Promise<void> {
    await this.table().where({ financial_year_id: financialYearId }).delete();

    if (rows.length === 0) return;

    const now = new Date().toISOString();
    await this.table().insert(
      rows.map((r) => ({
        id: uuidv4(),
        tenant_id: this.tenantId,
        financial_year_id: financialYearId,
        account_id: r.account_id,
        debit: r.debit,
        credit: r.credit,
        created_at: now,
        updated_at: now,
      }))
    );
  }
}
