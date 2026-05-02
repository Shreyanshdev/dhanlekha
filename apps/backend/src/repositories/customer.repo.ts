import { Knex } from 'knex';
import { BaseRepository } from './base.repo';
import type { Customer } from '@dhanlekha/shared';

export class CustomerRepository extends BaseRepository<Customer> {
  constructor(tenantId: string, trx?: Knex.Transaction) {
    super(tenantId, 'customers', trx);
  }

  /**
   * Find a customer by phone number within the tenant
   */
  async findByPhone(phone: string): Promise<Customer | undefined> {
    return await this.getQuery().where({ phone }).first();
  }

  /**
   * Search customers by name or phone
   */
  async search(query: string): Promise<Customer[]> {
    return await this.getQuery()
      .where((builder) => {
        builder.where('name', 'like', `%${query}%`)
               .orWhere('phone', 'like', `%${query}%`);
      })
      .orderBy('name', 'asc');
  }

  /**
   * Update the running balance (total_due)
   */
  async updateBalance(customerId: string, amount: number): Promise<void> {
    await this.getQuery().where({ id: customerId }).increment('total_due', amount);
  }
}
