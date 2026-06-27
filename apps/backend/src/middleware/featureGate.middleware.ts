import type { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthenticationError, ForbiddenError, NotFoundError } from '../utils/errors';
import { UsageRepository } from '../repositories/usage.repo';

/**
 * Resolve the effective access for a tenant + feature, honouring
 * `tenant_overrides` first, then falling back to the tenant's `plan_features`.
 */
async function resolveFeature(tenantId: string, featureId: string): Promise<{
  isEnabled: boolean;
  limitValue: number | null;
}> {
  const override = await db('tenant_overrides')
    .where({ tenant_id: tenantId, feature_id: featureId })
    .first();

  if (override) {
    return { isEnabled: !!override.is_enabled, limitValue: override.limit_value ?? null };
  }

  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) throw new NotFoundError('Tenant');

  const planFeature = await db('plan_features')
    .where({ plan_id: tenant.plan_id, feature_id: featureId })
    .first();

  if (!planFeature) {
    return { isEnabled: false, limitValue: null };
  }

  return { isEnabled: !!planFeature.is_enabled, limitValue: planFeature.limit_value ?? null };
}

/**
 * featureGate — Express middleware factory that enforces SaaS plan quotas.
 *
 * Usage:
 *   router.post('/', requireAuth, featureGate('max_invoices_per_month'), controller.create)
 *
 * Behaviour:
 *   - `boolean` features: blocks when the feature is disabled for the plan/tenant.
 *   - `limit` features: blocks when the current month's usage has reached the limit.
 *     (The route handler is responsible for incrementing usage on success.)
 */
export function featureGate(featureId: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');
      const { tenantId } = req.user;

      const { isEnabled, limitValue } = await resolveFeature(tenantId, featureId);

      if (!isEnabled) {
        throw new ForbiddenError(
          `Feature '${featureId}' is not available on your plan. Please upgrade.`
        );
      }

      const flag = await db('feature_flags').where({ id: featureId }).first();
      if (flag?.type === 'limit' && limitValue != null) {
        const usageRepo = new UsageRepository(tenantId);
        const used = await usageRepo.getUsedCount(featureId);
        if (used >= limitValue) {
          throw new ForbiddenError(
            `Monthly limit reached for '${featureId}' (${used}/${limitValue}). Please upgrade your plan.`
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export default featureGate;
