import type { Request, Response, NextFunction } from 'express';
import * as productsService from './products.service';
import { success, created } from '../../utils/response';

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const query = req.query.q as string | undefined;
    const products = await productsService.listProducts(tenantId, query);
    return success(res, products);
  } catch (error) {
    next(error);
  }
}

export async function getByBarcode(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId } = req.user!;
    if (!branchId) throw new Error('Branch context is required for barcode lookup');
    const { code } = req.params;
    const product = await productsService.findProductByBarcode(tenantId, branchId, code);
    return success(res, product);
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, userId, branchId } = req.user!;
    
    if (!branchId) {
      throw new Error('Branch context is required to create a product (initial inventory)');
    }

    const product = await productsService.createProduct(tenantId, branchId, userId, req.body);
    return created(res, product);
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const product = await productsService.updateProduct(tenantId, id, req.body);
    return success(res, product);
  } catch (error) {
    next(error);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    await productsService.deleteProduct(tenantId, id);
    return success(res, { message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function adjustInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, userId, branchId } = req.user!;
    const { id } = req.params;

    if (!branchId) {
      throw new Error('Branch context is required for inventory adjustment');
    }

    const inventory = await productsService.adjustInventory(tenantId, branchId, userId, id, req.body);
    return success(res, inventory);
  } catch (error) {
    next(error);
  }
}

export async function getLowStockAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId, branchId } = req.user!;
    
    if (!branchId) {
      throw new Error('Branch context is required for stock alerts');
    }

    const alerts = await productsService.getLowStockAlerts(tenantId, branchId);
    return success(res, alerts);
  } catch (error) {
    next(error);
  }
}
