import { TenantRepository } from '../repositories/tenant.repo';
import { AnalyticsRepository } from '../repositories/analytics.repo';
import { aggregateDailyMetrics } from '../modules/analytics/analytics.service';
import db from '../config/database';

export async function generateDailyMetrics(targetDate?: string) {
  const date = targetDate || new Date(Date.now() - 86400000).toISOString().split('T')[0]; // Default to yesterday
  console.log(`[Jobs] Generating daily metrics for ${date}...`);

  const tenantRepo = new TenantRepository();
  const tenants = await tenantRepo.findAll();

  for (const tenant of tenants) {
    const analyticsRepo = new AnalyticsRepository(tenant.id);

    // 1. Aggregate global tenant metrics
    const tenantMetrics = await aggregateDailyMetrics(tenant.id, date);
    await analyticsRepo.upsertDailyMetric(tenantMetrics);

    // 2. Aggregate per-branch metrics
    const branches = await db('branches').where({ tenant_id: tenant.id, is_deleted: false });
    for (const branch of branches) {
      const branchMetrics = await aggregateDailyMetrics(tenant.id, date, branch.id);
      await analyticsRepo.upsertDailyMetric({
        ...branchMetrics,
        branch_id: branch.id
      });
    }
  }

  console.log(`[Jobs] Daily metrics generation finished for ${date}.`);
}
