import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import {
  createSupplierPaymentSchema,
  allocateSupplierPaymentSchema,
  supplierPaymentIdParamSchema,
  listSupplierPaymentsQuerySchema,
} from './supplier-payments.validator';
import {
  createSupplierPayment,
  allocateSupplierPayment,
  getSupplierPaymentById,
  listSupplierPayments,
} from './supplier-payments.controller';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  validate(createSupplierPaymentSchema, 'body'),
  createSupplierPayment
);

router.get(
  '/',
  validate(listSupplierPaymentsQuerySchema, 'query'),
  listSupplierPayments
);

router.get(
  '/:id',
  validate(supplierPaymentIdParamSchema, 'params'),
  getSupplierPaymentById
);

router.post(
  '/:id/allocate',
  validate(supplierPaymentIdParamSchema, 'params'),
  validate(allocateSupplierPaymentSchema, 'body'),
  allocateSupplierPayment
);

export default router;
