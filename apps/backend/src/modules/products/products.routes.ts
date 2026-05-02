import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import validate from '../../middleware/validate.middleware';
import * as productsController from './products.controller';
import {
  createProductSchema,
  updateProductSchema,
  adjustInventorySchema,
  productIdParamSchema,
  barcodeParamSchema
} from './products.validator';

const router = Router();

// Protect all product routes with JWT
router.use(requireAuth);

// ─── Cashier + Admin Routes ─────────────────────────────────

// Cashiers can list products, scan barcodes, and see low stock alerts
router.get('/', productsController.listProducts);
router.get('/barcode/:code', validate(barcodeParamSchema, 'params'), productsController.getByBarcode);
router.get('/low-stock', productsController.getLowStockAlerts);

// ─── Admin Only Routes ──────────────────────────────────────

router.use(authorize('admin')); // The following routes require admin role

// Product Catalogue Management
router.post('/', validate(createProductSchema), productsController.createProduct);
router.patch('/:id', validate(productIdParamSchema, 'params'), validate(updateProductSchema), productsController.updateProduct);
router.delete('/:id', validate(productIdParamSchema, 'params'), productsController.deleteProduct);

// Inventory Management
router.post('/:id/adjust', validate(productIdParamSchema, 'params'), validate(adjustInventorySchema), productsController.adjustInventory);

export default router;
