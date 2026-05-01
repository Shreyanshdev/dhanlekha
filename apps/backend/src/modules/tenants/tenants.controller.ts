import type { Request, Response, NextFunction } from 'express';
import * as tenantsService from './tenants.service';
import { success } from '../../utils/response';

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const tenant = await tenantsService.getTenantById(tenantId);
    return success(res, tenant);
  } catch (error) {
    next(error);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const tenant = await tenantsService.updateTenant(tenantId, req.body);
    return success(res, tenant);
  } catch (error) {
    next(error);
  }
}
