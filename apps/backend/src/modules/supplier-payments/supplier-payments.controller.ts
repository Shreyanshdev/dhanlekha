import type { Request, Response, NextFunction } from 'express';
import * as supplierPaymentsService from './supplier-payments.service';
import { success, created, paginated } from '../../utils/response';

export async function createSupplierPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId, userId } = req.user!;
    if (!branchId) throw new Error('Branch context is required');
    const payment = await supplierPaymentsService.createSupplierPayment(
      tenantId,
      branchId,
      userId,
      req.body
    );
    return created(res, payment);
  } catch (err) {
    next(err);
  }
}

export async function allocateSupplierPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId, userId } = req.user!;
    if (!branchId) throw new Error('Branch context is required');
    const { id } = req.params;
    const payment = await supplierPaymentsService.allocateSupplierPayment(
      tenantId,
      branchId,
      userId,
      id,
      req.body
    );
    return success(res, payment);
  } catch (err) {
    next(err);
  }
}

export async function getSupplierPaymentById(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId } = req.user!;
    if (!branchId) throw new Error('Branch context is required');
    const { id } = req.params;
    const payment = await supplierPaymentsService.getSupplierPaymentById(tenantId, branchId, id);
    return success(res, payment);
  } catch (err) {
    next(err);
  }
}

export async function listSupplierPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId } = req.user!;
    if (!branchId) throw new Error('Branch context is required');

    const page = parseInt(req.query.page as string ?? '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string ?? '20', 10), 100);
    const filters = {
      supplier_id: req.query.supplier_id as string | undefined,
      status: req.query.status as string | undefined,
      payment_mode: req.query.payment_mode as string | undefined,
    };

    const { items, total } = await supplierPaymentsService.listSupplierPayments(
      tenantId,
      branchId,
      page,
      limit,
      filters
    );
    return paginated(res, items, { page, limit, total });
  } catch (err) {
    next(err);
  }
}
