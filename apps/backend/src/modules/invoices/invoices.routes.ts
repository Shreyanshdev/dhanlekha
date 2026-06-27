import { Router } from 'express';
import * as invoicesController from './invoices.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { featureGate } from '../../middleware/featureGate.middleware';
import validate from '../../middleware/validate.middleware';
import { createInvoiceSchema, invoiceIdParamSchema, invoiceQuerySchema } from './invoices.validator';

const router = Router();

router.use(requireAuth);

router.get('/', validate(invoiceQuerySchema, 'query'), invoicesController.listInvoices);
router.get('/:id', validate(invoiceIdParamSchema, 'params'), invoicesController.getInvoice);
router.post('/', featureGate('max_invoices_per_month'), validate(createInvoiceSchema), invoicesController.createInvoice);
router.delete('/:id', validate(invoiceIdParamSchema, 'params'), invoicesController.cancelInvoice);

export default router;
