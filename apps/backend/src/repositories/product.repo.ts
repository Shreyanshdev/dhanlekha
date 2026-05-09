import { Knex } from 'knex';
import { BaseRepository } from './base.repo';
import { cacheService, cacheKeys } from '../services/cache.service';
import type { Product } from '@dhanlekha/shared';

export class ProductRepository extends BaseRepository<Product> {
  constructor(tenantId: string, trx?: Knex.Transaction) {
    super(tenantId, 'products', trx);
  }

  /**
   * Find a product by its barcode (HOT PATH — barcode scanner).
   * Cached in Redis for sub-50ms lookups.
   */
  async findByBarcode(barcode: string): Promise<Product | undefined> {
    const key = cacheKeys.productBarcode(this.tenantId, barcode);

    const cached = await cacheService.get<Product>(key);
    if (cached) return cached;

    const product = await this.getQuery().where({ barcode }).first();
    if (product) {
      // Cache for 10 minutes — products rarely change mid-session
      await cacheService.set(key, product, 600);
    }
    return product;
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

  /**
   * Override create/update to invalidate product cache.
   */
  async create(data: Partial<Product>): Promise<void> {
    await super.create(data);
    await cacheService.delPattern(cacheKeys.allTenantProducts(this.tenantId));
  }

  async update(id: string, data: Partial<Product>): Promise<number> {
    const result = await super.update(id, data);
    await cacheService.delPattern(cacheKeys.allTenantProducts(this.tenantId));
    return result;
  }
}

