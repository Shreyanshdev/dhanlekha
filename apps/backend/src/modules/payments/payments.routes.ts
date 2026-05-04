import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import {
  createPaymentSchema,
  allocatePaymentSchema,
  paymentIdParamSchema,
  listPaymentsQuerySchema,
} from './payments.validator';
import {
  createPayment,
  allocatePayment,
  getPaymentById,
  listPayments,
} from './payments.controller';

const router = Router();

// All payment routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/payments
 * Record a new payment and optionally allocate it to invoices.
 */
router.post(
  '/',
  validate(createPaymentSchema, 'body'),
  createPayment
);

/**
 * GET /api/v1/payments
 * List payments for the branch (paginated, filterable by customer/status/mode).
 */
router.get(
  '/',
  validate(listPaymentsQuerySchema, 'query'),
  listPayments
);

/**
 * GET /api/v1/payments/:id
 * Get a specific payment with its allocations.
 */
router.get(
  '/:id',
  validate(paymentIdParamSchema, 'params'),
  getPaymentById
);

/**
 * POST /api/v1/payments/:id/allocate
 * Allocate an existing payment (advance payment) to specific invoices.
 */
router.post(
  '/:id/allocate',
  validate(paymentIdParamSchema, 'params'),
  validate(allocatePaymentSchema, 'body'),
  allocatePayment
);

export default router;
