import { NotFoundError } from '../../utils/errors';
import { TenantRepository } from '../../repositories/tenant.repo';

/**
 * Get the current tenant profile with plan details.
 */
export async function getTenantById(tenantId: string) {
  const repo = new TenantRepository();
  const tenant = await repo.findByIdWithPlan(tenantId);

  if (!tenant) {
    throw new NotFoundError('Tenant');
  }

  return tenant;
}

/**
 * Update the current tenant profile.
 */
export async function updateTenant(tenantId: string, updates: any) {
  const repo = new TenantRepository();
  const count = await repo.update(tenantId, updates);

  if (count === 0) {
    throw new NotFoundError('Tenant');
  }

  return await getTenantById(tenantId);
}
