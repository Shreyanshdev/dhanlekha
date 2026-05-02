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
  constructor() {
    // Tenants table is global — pass empty string as tenantId
    super('', 'tenants');
  }

  /** Override: tenants table has no tenant_id column */
  protected getQuery(trx?: Knex.Transaction) {
    return this.getRawQuery(trx);
  }

  async findById(id: string, trx?: Knex.Transaction): Promise<Tenant | undefined> {
    return await this.getQuery(trx).where({ id }).first();
  }

  async findByEmail(email: string, trx?: Knex.Transaction): Promise<Tenant | undefined> {
    return await this.getQuery(trx).where({ email }).first();
  }

  async findByIdWithPlan(id: string, trx?: Knex.Transaction): Promise<any> {
    const tenant = await this.getQuery(trx)
      .select('id', 'name', 'email', 'phone', 'plan_id', 'status', 'created_at')
      .where({ id })
      .first();

    if (!tenant) return undefined;

    // Fetch associated plan
    const qb = trx ? trx('plans') : (await import('../config/database')).default('plans');
    const plan = await qb.where({ id: tenant.plan_id }).first();
    tenant.plan = plan;

    return tenant;
  }

  /** Override: tenants table insert doesn't need tenant_id */
  async create(data: Partial<Tenant>, trx?: Knex.Transaction): Promise<void> {
    await this.getInsertQuery(trx).insert(data);
  }

  async update(id: string, data: Partial<Tenant>, trx?: Knex.Transaction): Promise<number> {
    return await this.getQuery(trx).where({ id }).update(data);
  }
}
