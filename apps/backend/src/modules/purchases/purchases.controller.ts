import { Request, Response, NextFunction } from 'express';
import * as purchaseService from './purchases.service';
import { success, created, paginated } from '../../utils/response';

export async function createPurchase(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const purchase = await purchaseService.createPurchase(tenantId, userId, req.body);
    return created(res, purchase);
  } catch (err) {
    next(err);
  }
}

export async function listPurchases(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const page = parseInt(req.query.page as string ?? '1', 10);
    const limit = parseInt(req.query.limit as string ?? '20', 10);
    const filters = {
      branch_id: req.query.branch_id as string,
      supplier_id: req.query.supplier_id as string,
      from: req.query.from as string,
      to: req.query.to as string,
    };

    const result = await purchaseService.listPurchases(tenantId, page, limit, filters);
    return paginated(res, result.items, { page, limit, total: result.total });
  } catch (err) {
    next(err);
  }
}

export async function getPurchaseDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const purchase = await purchaseService.getPurchaseDetail(tenantId, id);
    return success(res, purchase);
  } catch (err) {
    next(err);
  }
}
