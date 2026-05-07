import { AlertRepository } from '../../repositories/alert.repo';
import { NotFoundError } from '../../utils/errors';
import type { Alert } from '@dhanlekha/shared';
import type { ListAlertsInput } from './alerts.validator';

export async function listAlerts(
  tenantId: string,
  filters: ListAlertsInput,
  userRole: string,
  userBranchId?: string
): Promise<{ items: Alert[]; total: number }> {
  const repo = new AlertRepository(tenantId);
  const page = parseInt(filters.page || '1', 10);
  const limit = parseInt(filters.limit || '50', 10);

  let targetBranchId = filters.branch_id;
  if (userRole === 'cashier') {
    targetBranchId = userBranchId;
  }

  const queryFilters: any = {};
  if (targetBranchId) queryFilters.branch_id = targetBranchId;
  if (filters.is_read !== undefined) queryFilters.is_read = filters.is_read === 'true';
  if (filters.alert_type) queryFilters.alert_type = filters.alert_type;

  return await repo.listPaged(page, limit, queryFilters);
}

export async function markAsRead(tenantId: string, alertId: string): Promise<Alert> {
  const repo = new AlertRepository(tenantId);
  
  const alert = await repo.findById(alertId);
  if (!alert) {
    throw new NotFoundError('Alert');
  }

  await repo.markAsRead(alertId);
  return { ...alert, is_read: true };
}
