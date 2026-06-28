import type { Request, Response, NextFunction } from 'express';
import * as suppliersService from './suppliers.service';
import { success, created, paginated } from '../../utils/response';

export async function listSuppliers(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const query = req.query.q as string | undefined;
    const suppliers = await suppliersService.listSuppliers(tenantId, query);
    return success(res, suppliers);
  } catch (error) {
    next(error);
  }
}

export async function getSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const supplier = await suppliersService.getSupplierById(tenantId, id);
    return success(res, supplier);
  } catch (error) {
    next(error);
  }
}

export async function createSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const supplier = await suppliersService.createSupplier(tenantId, req.body);
    return created(res, supplier);
  } catch (error) {
    next(error);
  }
}

export async function updateSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const supplier = await suppliersService.updateSupplier(tenantId, id, req.body);
    return success(res, supplier);
  } catch (error) {
    next(error);
  }
}

export async function deleteSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    await suppliersService.deleteSupplier(tenantId, id);
    return success(res, { message: 'Supplier deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getSupplierLedger(req: Request, res: Response, next: NextFunction) {
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
    const { items, total } = await suppliersService.getSupplierLedger(
      tenantId,
      id,
      page,
      limit,
      filters
    );
    return paginated(res, items, { page, limit, total });
  } catch (error) {
    next(error);
  }
}

export async function getSupplierBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const balance = await suppliersService.getSupplierBalance(tenantId, id);
    return success(res, balance);
  } catch (error) {
    next(error);
  }
}
