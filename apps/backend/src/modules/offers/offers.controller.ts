import { Request, Response, NextFunction } from 'express';
import * as offerService from './offers.service';
import { success, created, paginated } from '../../utils/response';

export async function createOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const offer = await offerService.createOffer(tenantId, req.body);
    return created(res, offer);
  } catch (err) {
    next(err);
  }
}

export async function getOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const offer = await offerService.getOfferById(tenantId, id);
    return success(res, offer);
  } catch (err) {
    next(err);
  }
}

export async function updateOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const offer = await offerService.updateOffer(tenantId, id, req.body);
    return success(res, offer);
  } catch (err) {
    next(err);
  }
}

export async function deleteOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    await offerService.deleteOffer(tenantId, id);
    return success(res, { message: 'Offer deleted' });
  } catch (err) {
    next(err);
  }
}

export async function listOffers(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const page = parseInt(req.query.page as string ?? '1', 10);
    const limit = parseInt(req.query.limit as string ?? '20', 10);
    const filters = {
      branch_id: req.query.branch_id as string,
      offer_type: req.query.offer_type as string,
      applies_to: req.query.applies_to as string,
      is_active: req.query.is_active as string,
      from: req.query.from as string,
      to: req.query.to as string,
    };
    const result = await offerService.listOffers(tenantId, page, limit, filters);
    return paginated(res, result.items, { page, limit, total: result.total });
  } catch (err) {
    next(err);
  }
}
