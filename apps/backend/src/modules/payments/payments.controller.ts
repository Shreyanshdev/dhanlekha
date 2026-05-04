import type { Request, Response, NextFunction } from 'express';
import * as paymentsService from './payments.service';
import { success, created, paginated } from '../../utils/response';

export async function createPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId, userId } = req.user!;
    if (!branchId) throw new Error('Branch context is required');
    const payment = await paymentsService.createPayment(tenantId, branchId, userId, req.body);
    return created(res, payment);
  } catch (err) {
    next(err);
  }
}

export async function allocatePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId, userId } = req.user!;
    if (!branchId) throw new Error('Branch context is required');
    const { id } = req.params;
    const payment = await paymentsService.allocatePayment(tenantId, branchId, userId, id, req.body);
    return success(res, payment);
  } catch (err) {
    next(err);
  }
}

export async function getPaymentById(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId } = req.user!;
    if (!branchId) throw new Error('Branch context is required');
    const { id } = req.params;
    const payment = await paymentsService.getPaymentById(tenantId, branchId, id);
    return success(res, payment);
  } catch (err) {
    next(err);
  }
}

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId } = req.user!;
    if (!branchId) throw new Error('Branch context is required');

    const page = parseInt(req.query.page as string ?? '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string ?? '20', 10), 100);
    const filters = {
      customer_id: req.query.customer_id as string | undefined,
      status: req.query.status as string | undefined,
      payment_mode: req.query.payment_mode as string | undefined,
    };

    const { items, total } = await paymentsService.listPayments(tenantId, branchId, page, limit, filters);
    return paginated(res, items, { page, limit, total });
  } catch (err) {
    next(err);
  }
}
