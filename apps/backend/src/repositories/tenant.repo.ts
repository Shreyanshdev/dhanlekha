import { Knex } from 'knex';
import { BaseRepository } from './base.repo';
import type { Tenant } from '@dhanlekha/shared';

/**
 * TenantRepository — handles queries against the `tenants` table.
 *
 * NOTE: `tenants` is a global table (not scoped by tenant_id), so we
 * override getQuery() to only apply is_deleted filtering.
 */
export class TenantRepository extends BaseRepository<Tenant> {
  constructor(trx?: Knex.Transaction) {
    // Tenants table is global — pass empty string as tenantId
    super('', 'tenants', trx);
  }

  /** Override: tenants table has no tenant_id column */
  protected getQuery(): Knex.QueryBuilder {
    return this.getRawQuery();
  }

  async findById(id: string): Promise<Tenant | undefined> {
    return await this.getQuery().where({ id }).first();
  }

  async findByEmail(email: string): Promise<Tenant | undefined> {
    return await this.getQuery().where({ email }).first();
  }

  async findByIdWithPlan(id: string): Promise<any> {
    const tenant = await this.getQuery()
      .select('id', 'name', 'email', 'phone', 'plan_id', 'status', 'created_at')
      .where({ id })
      .first();

    if (!tenant) return undefined;

    // Fetch associated plan
    const qb = this.trx ? this.trx('plans') : (await import('../config/database')).default('plans');
    const plan = await qb.where({ id: tenant.plan_id }).first();
    tenant.plan = plan;

    return tenant;
  }

  /** Override: tenants table insert doesn't need tenant_id */
  async create(data: Partial<Tenant>): Promise<void> {
    await this.getInsertQuery().insert(data);
  }

  async update(id: string, data: Partial<Tenant>): Promise<number> {
    return await this.getQuery().where({ id }).update(data);
  }
}
