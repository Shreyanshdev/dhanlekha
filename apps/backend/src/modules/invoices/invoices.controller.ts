import type { Request, Response, NextFunction } from 'express';
import * as invoicesService from './invoices.service';
import { success, created, paginated } from '../../utils/response';

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId, userId } = req.user!;
    if (!branchId) throw new Error('Branch ID is required for billing');
    
    const invoice = await invoicesService.createInvoice(tenantId, branchId, userId, req.body);
    return created(res, invoice);
  } catch (error) {
    next(error);
  }
}

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId } = req.user!;
    if (!branchId) throw new Error('Branch ID is required');
    
    const result = await invoicesService.listInvoices(tenantId, branchId, req.query);
    return paginated(res, result.items, {
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
      total: result.total
    });
  } catch (error) {
    next(error);
  }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId } = req.user!;
    if (!branchId) throw new Error('Branch ID is required');
    
    const invoice = await invoicesService.getInvoiceDetails(tenantId, branchId, req.params.id);
    return success(res, invoice);
  } catch (error) {
    next(error);
  }
}

export async function cancelInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId, userId } = req.user!;
    if (!branchId) throw new Error('Branch ID is required');
    
    await invoicesService.cancelInvoice(tenantId, branchId, userId, req.params.id);
    return success(res, { message: 'Invoice cancelled successfully' });
  } catch (error) {
    next(error);
  }
}
