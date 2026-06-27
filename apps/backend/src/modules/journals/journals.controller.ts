import type { Request, Response, NextFunction } from 'express';
import * as journalsService from './journals.service';
import { success, created, paginated } from '../../utils/response';

export async function listJournals(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const limit = parseInt((req.query.limit as string) ?? '20', 10);
    const result = await journalsService.listJournals(req.user!.tenantId, page, limit, {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      reference_type: req.query.reference_type as string | undefined,
      reference_id: req.query.reference_id as string | undefined,
    });
    return paginated(res, result.items, { page, limit, total: result.total });
  } catch (err) {
    next(err);
  }
}

export async function createJournal(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId, userId } = req.user!;
    const entry = await journalsService.createManualJournal(tenantId, branchId ?? null, userId, req.body);
    return created(res, entry);
  } catch (err) {
    next(err);
  }
}
