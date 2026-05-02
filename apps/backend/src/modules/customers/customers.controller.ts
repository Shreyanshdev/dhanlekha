import type { Request, Response, NextFunction } from 'express';
import * as customersService from './customers.service';
import { success, created } from '../../utils/response';

export async function listCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const query = req.query.q as string | undefined;
    const customers = await customersService.listCustomers(tenantId, query);
    return success(res, customers);
  } catch (error) {
    next(error);
  }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const customer = await customersService.getCustomerById(tenantId, id);
    return success(res, customer);
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const customer = await customersService.createCustomer(tenantId, req.body);
    return created(res, customer);
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const customer = await customersService.updateCustomer(tenantId, id, req.body);
    return success(res, customer);
  } catch (error) {
    next(error);
  }
}

export async function deleteCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    await customersService.deleteCustomer(tenantId, id);
    return success(res, { message: 'Customer deleted successfully' });
  } catch (error) {
    next(error);
  }
}
