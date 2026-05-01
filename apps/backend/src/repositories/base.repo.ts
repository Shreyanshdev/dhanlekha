import { Knex } from 'knex';
import db from '../config/database';

/**
 * Base Repository enforcing tenant isolation.
 * ALL queries extending this class will automatically be scoped to the tenant_id
 * unless bypassed explicitly (which should be rare).
 */
export class BaseRepository<T> {
  protected tenantId: string;
  protected tableName: string;

  constructor(tenantId: string, tableName: string) {
    this.tenantId = tenantId;
    this.tableName = tableName;
  }

  /**
   * Get the base query builder with tenant isolation applied.
   */
  protected getQuery(trx?: Knex.Transaction) {
    const qb = trx ? trx(this.tableName) : db(this.tableName);
    // Almost every table in the ERP has a tenant_id
    if (this.tableName !== 'tenants' && this.tableName !== 'plans') {
      return qb.where({ tenant_id: this.tenantId, is_deleted: false });
    }
    return qb.where({ is_deleted: false });
  }

  async findById(id: string, trx?: Knex.Transaction): Promise<T | undefined> {
    const record = await this.getQuery(trx).where({ id }).first();
    return record;
  }

  async findAll(trx?: Knex.Transaction): Promise<T[]> {
    return await this.getQuery(trx);
  }

  async create(data: Partial<T>, trx?: Knex.Transaction): Promise<T> {
    const [id] = await (trx ? trx(this.tableName) : db(this.tableName))
      .insert({ ...data, tenant_id: this.tenantId })
      .returning('id');
      
    // In SQLite returning might act differently, but we assume uuid is passed in or handled
    return data as T;
  }

  async update(id: string, data: Partial<T>, trx?: Knex.Transaction): Promise<number> {
    return await this.getQuery(trx).where({ id }).update(data);
  }

  async softDelete(id: string, trx?: Knex.Transaction): Promise<number> {
    return await this.getQuery(trx).where({ id }).update({ is_deleted: true });
  }
}
