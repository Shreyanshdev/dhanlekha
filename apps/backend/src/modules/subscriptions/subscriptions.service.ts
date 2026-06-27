import { v4 as uuidv4 } from 'uuid';
import { SubscriptionRepository } from '../../repositories/subscription.repo';
import { TenantRepository } from '../../repositories/tenant.repo';
import { UsageRepository } from '../../repositories/usage.repo';
import { withTransaction } from '../../database/transaction';
import { NotFoundError } from '../../utils/errors';
import type { ChangePlanInput } from './subscriptions.validator';

/** Add one calendar month to an ISO date, returned as an ISO string. */
function addOneMonth(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Return the tenant's subscription overview: current plan, status, billing
 * period, this month's metered usage vs limits, and the catalogue of plans.
 */
export async function getSubscription(tenantId: string) {
  const tenantRepo = new TenantRepository();
  const tenant = await tenantRepo.findById(tenantId);
  if (!tenant) throw new NotFoundError('Tenant');

  const subRepo = new SubscriptionRepository(tenantId);
  const usageRepo = new UsageRepository(tenantId);

  const [plan, current, plans, limitFeatures] = await Promise.all([
    subRepo.findPlan(tenant.plan_id),
    subRepo.getCurrent(),
    subRepo.listPlans(),
    subRepo.getPlanLimitFeatures(tenant.plan_id),
  ]);

  const usage = await Promise.all(
    limitFeatures.map(async (f) => ({
      feature_id: f.feature_id,
      description: f.description,
      limit: f.limit_value,
      used: await usageRepo.getUsedCount(f.feature_id),
    }))
  );

  return {
    tenant_id: tenantId,
    status: current?.status ?? tenant.status,
    plan: plan ?? { id: tenant.plan_id },
    current_period_start: current?.current_period_start ?? null,
    current_period_end: current?.current_period_end ?? null,
    usage,
    available_plans: plans,
  };
}

/**
 * Upgrade or downgrade the tenant's plan. Updates `tenants.plan_id` and the
 * `subscriptions` record atomically. (No payment gateway yet — that lands in
 * Sprint 29; this records the plan change and resets the billing period.)
 */
export async function changePlan(tenantId: string, data: ChangePlanInput) {
  await withTransaction(async (trx) => {
    const subRepo = new SubscriptionRepository(tenantId, trx);
    const tenantRepo = new TenantRepository(trx);

    const plan = await subRepo.findPlan(data.plan_id);
    if (!plan) throw new NotFoundError('Plan');

    await tenantRepo.update(tenantId, { plan_id: data.plan_id });

    const now = new Date();
    const periodEnd = addOneMonth(now);
    const existing = await subRepo.getCurrent();

    if (existing) {
      await subRepo.update(existing.id, {
        plan_id: data.plan_id,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      });
    } else {
      await subRepo.create({
        id: uuidv4(),
        tenant_id: tenantId,
        plan_id: data.plan_id,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
    }
  });

  // Read fresh state only after the change has committed.
  return getSubscription(tenantId);
}
