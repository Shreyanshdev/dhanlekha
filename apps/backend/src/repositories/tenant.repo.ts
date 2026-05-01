import { Knex } from 'knex';
import db from '../config/database';
import { BaseRepository } from './base.repo';
import { Tenant } from '@dhanlekha/shared';

export class TenantRepository extends BaseRepository<Tenant> {
  constructor(tenantId: string) {
    // We pass tenantId for the scope, though tenants table is global
    super(tenantId, 'tenants');
  }

  async findByEmail(email: string, trx?: Knex.Transaction): Promise<Tenant | undefined> {
    const qb = trx ? trx(this.tableName) : db(this.tableName);
    return await qb.where({ email, is_deleted: false }).first();
  }

  // Override findById since tenants table doesn't have a tenant_id column
  async findById(id: string, trx?: Knex.Transaction): Promise<Tenant | undefined> {
    const qb = trx ? trx(this.tableName) : db(this.tableName);
    return await qb.where({ id, is_deleted: false }).first();
  }

  // Override update since tenants table doesn't have a tenant_id column
  async update(id: string, data: Partial<Tenant>, trx?: Knex.Transaction): Promise<number> {
    const qb = trx ? trx(this.tableName) : db(this.tableName);
    return await qb.where({ id, is_deleted: false }).update(data);
  }
}
