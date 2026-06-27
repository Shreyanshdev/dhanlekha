import type { Request, Response, NextFunction } from 'express';
import * as accountsService from './accounts.service';
import { success, created } from '../../utils/response';

export async function listAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const tree = await accountsService.getChartOfAccounts(req.user!.tenantId);
    return success(res, tree);
  } catch (err) {
    next(err);
  }
}

export async function createAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await accountsService.createAccount(req.user!.tenantId, req.body);
    return created(res, account);
  } catch (err) {
    next(err);
  }
}

export async function getAccountLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const ledger = await accountsService.getAccountLedger(req.user!.tenantId, req.params.id, {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    return success(res, ledger);
  } catch (err) {
    next(err);
  }
}
