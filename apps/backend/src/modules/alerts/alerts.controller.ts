import { Request, Response, NextFunction } from 'express';
import * as alertsService from './alerts.service';
import { success, paginated } from '../../utils/response';

export async function listAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const role = req.user!.role;
    const branchId = req.user!.branchId;

    const result = await alertsService.listAlerts(tenantId, req.query as any, role, branchId);
    
    return paginated(res, result.items, {
      page: parseInt((req.query.page as string) || '1', 10),
      limit: parseInt((req.query.limit as string) || '50', 10),
      total: result.total
    });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const alertId = req.params.id;

    const result = await alertsService.markAsRead(tenantId, alertId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}
