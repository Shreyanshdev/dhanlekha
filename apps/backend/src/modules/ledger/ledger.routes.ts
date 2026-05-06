import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import validate from '../../middleware/validate.middleware';
import {
  createAdjustmentSchema,
  ledgerQuerySchema,
  customerIdParamSchema,
} from './ledger.validator';
import {
  getCustomerLedger,
  getCustomerBalance,
  createAdjustment,
} from './ledger.controller';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/customers/:id/ledger
 * Paginated ledger entries (filterable by date range and entry type).
 */
router.get(
  '/customers/:id/ledger',
  validate(customerIdParamSchema, 'params'),
  validate(ledgerQuerySchema, 'query'),
  getCustomerLedger
);

/**
 * GET /api/v1/customers/:id/balance
 * Current balance summary with integrity verification.
 */
router.get(
  '/customers/:id/balance',
  validate(customerIdParamSchema, 'params'),
  getCustomerBalance
);

/**
 * POST /api/v1/ledger/adjust
 * Manual ledger adjustment (admin only).
 * Used for write-offs, corrections, or opening balances.
 */
router.post(
  '/ledger/adjust',
  authorize('admin'),
  validate(createAdjustmentSchema, 'body'),
  createAdjustment
);

export default router;
