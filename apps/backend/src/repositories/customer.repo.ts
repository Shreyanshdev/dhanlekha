import { Knex } from 'knex';
import db from '../config/database';
import { BaseRepository } from './base.repo';
import type { Customer, CustomerLedger } from '@dhanlekha/shared';

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

  // ─── Customer Ledger Operations (Consolidated) ────────────

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
}
