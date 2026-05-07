import { Request, Response, NextFunction } from 'express';
import * as analyticsService from './analytics.service';
import { success } from '../../utils/response';

export async function getDailyAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const result = await analyticsService.getDailyAnalytics(tenantId, req.query as any);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getDashboardData(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const result = await analyticsService.getDashboardData(tenantId, req.query as any);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getProfitData(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const result = await analyticsService.getProfitData(tenantId, req.query as any);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}
