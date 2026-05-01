import db from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { TenantRepository } from '../../repositories/tenant.repo';

export async function getTenantById(tenantId: string) {
  const repo = new TenantRepository(tenantId);
  const tenant: any = await repo.findById(tenantId);

  if (!tenant) {
    throw new NotFoundError('Tenant');
  }

  // Also fetch the plan details
  const plan = await db('plans').where({ id: tenant.plan_id }).first();
  tenant.plan = plan;

  return tenant;
}

export async function updateTenant(tenantId: string, updates: any) {
  const repo = new TenantRepository(tenantId);
  const count = await repo.update(tenantId, updates);

  if (count === 0) {
    throw new NotFoundError('Tenant');
  }

  return await getTenantById(tenantId);
}
