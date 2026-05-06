import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import validate from '../../middleware/validate.middleware';
import { createExpenseSchema, expenseQuerySchema } from './expenses.validator';
import * as controller from './expenses.controller';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/expenses
 * List expenses (paginated)
 */
router.get('/', validate(expenseQuerySchema, 'query'), controller.listExpenses);

/**
 * POST /api/v1/expenses
 * Record a new expense (Admin only)
 */
router.post('/', authorize('admin'), validate(createExpenseSchema), controller.createExpense);

/**
 * DELETE /api/v1/expenses/:id
 * Remove an expense entry (Admin only)
 */
router.delete('/:id', authorize('admin'), controller.deleteExpense);

export default router;
