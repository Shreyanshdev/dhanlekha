import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import { reportQuerySchema } from './reports.validator';
import * as controller from './reports.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['admin']));

router.get('/trial-balance', validate(reportQuerySchema, 'query'), controller.trialBalance);
router.get('/profit-loss', validate(reportQuerySchema, 'query'), controller.profitAndLoss);
router.get('/balance-sheet', validate(reportQuerySchema, 'query'), controller.balanceSheet);
router.get('/cash-flow', validate(reportQuerySchema, 'query'), controller.cashFlow);
router.get('/day-book', validate(reportQuerySchema, 'query'), controller.dayBook);

export default router;
