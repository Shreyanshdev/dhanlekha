import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import {
  createFinancialYearSchema,
  closeFinancialYearSchema,
  financialYearIdParamSchema,
} from './financial-years.validator';
import * as controller from './financial-years.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['admin']));

router.get('/', controller.listFinancialYears);
router.post('/', validate(createFinancialYearSchema, 'body'), controller.createFinancialYear);
router.post(
  '/:id/close',
  validate(financialYearIdParamSchema, 'params'),
  validate(closeFinancialYearSchema, 'body'),
  controller.closeFinancialYear
);

export default router;
