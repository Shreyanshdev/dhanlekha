import { Knex } from 'knex';
import { BaseRepository } from './base.repo';
import type { Product } from '@dhanlekha/shared';

export class ProductRepository extends BaseRepository<Product> {
  constructor(tenantId: string, trx?: Knex.Transaction) {
    super(tenantId, 'products', trx);
  }

  /** Find a product by its barcode (super-fast lookup for scanner) */
  async findByBarcode(barcode: string): Promise<Product | undefined> {
    return await this.getQuery().where({ barcode }).first();
  }

  /** Search products by name or barcode, paginated */
  async search(query: string, limit: number = 20, offset: number = 0): Promise<Product[]> {
    return await this.getQuery()
      .where((builder) => {
        builder.where('name', 'like', `%${query}%`)
               .orWhere('barcode', 'like', `%${query}%`);
      })
      .orderBy('name', 'asc')
      .limit(limit)
      .offset(offset);
  }
}
