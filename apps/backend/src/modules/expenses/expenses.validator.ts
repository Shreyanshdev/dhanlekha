import { z } from 'zod';

export const createExpenseSchema = z.object({
  branch_id: z.string().uuid('Invalid branch ID'),
  category: z.enum(['rent', 'electricity', 'wages', 'packaging', 'transport', 'maintenance', 'marketing', 'other']),
  amount: z.number().positive('Amount must be positive'),
  note: z.string().max(500).optional().nullable(),
  payment_mode: z.enum(['cash', 'upi', 'bank_transfer']).default('cash'),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expense_date must be YYYY-MM-DD').optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const expenseQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  branch_id: z.string().uuid().optional(),
  category: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
