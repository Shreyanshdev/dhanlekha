import { Router } from 'express';
import * as suppliersController from './suppliers.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import { createSupplierSchema, updateSupplierSchema, supplierIdParamSchema, supplierLedgerQuerySchema } from './suppliers.validator';

const router = Router();

router.use(requireAuth);

router.get('/', suppliersController.listSuppliers);
router.get('/:id/ledger', validate(supplierIdParamSchema, 'params'), validate(supplierLedgerQuerySchema, 'query'), suppliersController.getSupplierLedger);
router.get('/:id/balance', validate(supplierIdParamSchema, 'params'), suppliersController.getSupplierBalance);
router.get('/:id', validate(supplierIdParamSchema, 'params'), suppliersController.getSupplier);
router.post('/', validate(createSupplierSchema), suppliersController.createSupplier);
router.patch('/:id', validate(supplierIdParamSchema, 'params'), validate(updateSupplierSchema), suppliersController.updateSupplier);
router.delete('/:id', validate(supplierIdParamSchema, 'params'), suppliersController.deleteSupplier);

export default router;
