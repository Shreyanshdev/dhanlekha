import { Knex } from 'knex';
import { BaseRepository } from './base.repo';
import type { Supplier } from '@dhanlekha/shared';

export class SupplierRepository extends BaseRepository<Supplier> {
  constructor(tenantId: string, trx?: Knex.Transaction) {
    super(tenantId, 'suppliers', trx);
  }

  /**
   * Find a supplier by GST number within the tenant
   */
  async findByGst(gstNumber: string): Promise<Supplier | undefined> {
    return await this.getQuery().where({ gst_number: gstNumber }).first();
  }

  /**
   * Search suppliers by name or phone
   */
  async search(query: string): Promise<Supplier[]> {
    return await this.getQuery()
      .where((builder) => {
        builder.where('name', 'like', `%${query}%`)
               .orWhere('phone', 'like', `%${query}%`);
      })
      .orderBy('name', 'asc');
  }
}
