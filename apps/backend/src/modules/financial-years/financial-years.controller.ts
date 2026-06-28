import type { Request, Response, NextFunction } from 'express';
import * as service from './financial-years.service';
import { created, success } from '../../utils/response';

export async function listFinancialYears(req: Request, res: Response, next: NextFunction) {
  try {
    const years = await service.listFinancialYears(req.user!.tenantId);
    return success(res, years);
  } catch (err) {
    next(err);
  }
}

export async function createFinancialYear(req: Request, res: Response, next: NextFunction) {
  try {
    const year = await service.createFinancialYear(req.user!.tenantId, req.body);
    return created(res, year);
  } catch (err) {
    next(err);
  }
}

export async function closeFinancialYear(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.closeFinancialYear(
      req.user!.tenantId,
      req.params.id,
      req.body
    );
    return success(res, result);
  } catch (err) {
    next(err);
  }
}
