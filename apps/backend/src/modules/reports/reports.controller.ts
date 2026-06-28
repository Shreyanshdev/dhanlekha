import type { Request, Response, NextFunction } from 'express';
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getCashFlow,
  getDayBook,
} from '../../accounting/reports.service';
import { resolveReportPeriod, resolveAsOfDate } from './reports.service';
import { success } from '../../utils/response';

export async function trialBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const period = await resolveReportPeriod(tenantId, req.query as any);
    const report = await getTrialBalance(tenantId, period);
    return success(res, report);
  } catch (err) {
    next(err);
  }
}

export async function profitAndLoss(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const period = await resolveReportPeriod(tenantId, req.query as any);
    const report = await getProfitAndLoss(tenantId, period);
    return success(res, report);
  } catch (err) {
    next(err);
  }
}

export async function balanceSheet(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { asOf, financialYearId } = await resolveAsOfDate(tenantId, req.query as any);
    const report = await getBalanceSheet(tenantId, asOf, financialYearId);
    return success(res, report);
  } catch (err) {
    next(err);
  }
}

export async function cashFlow(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const period = await resolveReportPeriod(tenantId, req.query as any);
    const report = await getCashFlow(tenantId, period);
    return success(res, report);
  } catch (err) {
    next(err);
  }
}

export async function dayBook(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const period = await resolveReportPeriod(tenantId, req.query as any);
    const report = await getDayBook(tenantId, period);
    return success(res, report);
  } catch (err) {
    next(err);
  }
}
