import type { Request, Response, NextFunction } from 'express';
import * as ledgerService from './ledger.service';
import { success, created, paginated } from '../../utils/response';

/**
 * GET /api/v1/customers/:id/ledger
 * Paginated chronological ledger entries for a customer.
 */
export async function getCustomerLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const page = parseInt(req.query.page as string ?? '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string ?? '20', 10), 100);
    const filters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      entry_type: req.query.entry_type as string | undefined,
    };

    const { items, total } = await ledgerService.getCustomerLedger(tenantId, id, page, limit, filters);
    return paginated(res, items, { page, limit, total });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/customers/:id/balance
 * Current balance + summary + integrity check.
 */
export async function getCustomerBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const balance = await ledgerService.getCustomerBalance(tenantId, id);
    return success(res, balance);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/ledger/adjust
 * Manual ledger adjustment (admin only).
 */
export async function createAdjustment(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const entry = await ledgerService.createAdjustment(tenantId, userId, req.body);
    return created(res, entry);
  } catch (err) {
    next(err);
  }
}
