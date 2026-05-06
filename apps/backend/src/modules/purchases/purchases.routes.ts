import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import validate from '../../middleware/validate.middleware';
import { createPurchaseSchema, purchaseQuerySchema } from './purchases.validator';
import * as controller from './purchases.controller';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/purchases
 * List purchases (paginated)
 */
router.get('/', validate(purchaseQuerySchema, 'query'), controller.listPurchases);

/**
 * GET /api/v1/purchases/:id
 * Get purchase detail with items
 */
router.get('/:id', controller.getPurchaseDetail);

/**
 * POST /api/v1/purchases
 * Record a new purchase (Admin only)
 */
router.post('/', authorize('admin'), validate(createPurchaseSchema), controller.createPurchase);

export default router;
