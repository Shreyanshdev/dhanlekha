import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import {
  createAccountSchema,
  accountIdParamSchema,
  accountLedgerQuerySchema,
} from './accounts.validator';
import * as controller from './accounts.controller';

const router = Router();

router.use(requireAuth);

// GET /api/v1/accounts — chart of accounts (tree)
router.get('/', controller.listAccounts);

// POST /api/v1/accounts — create ledger account (admin)
router.post('/', requireRole(['admin']), validate(createAccountSchema), controller.createAccount);

// GET /api/v1/accounts/:id/ledger — account ledger (running balance)
router.get(
  '/:id/ledger',
  validate(accountIdParamSchema, 'params'),
  validate(accountLedgerQuerySchema, 'query'),
  controller.getAccountLedger
);

export default router;
