import type { Request, Response, NextFunction } from 'express';
import * as subscriptionsService from './subscriptions.service';
import { success } from '../../utils/response';

export async function getSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const subscription = await subscriptionsService.getSubscription(tenantId);
    return success(res, subscription);
  } catch (error) {
    next(error);
  }
}

export async function changePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const result = await subscriptionsService.changePlan(tenantId, req.body);
    return success(res, result);
  } catch (error) {
    next(error);
  }
}
