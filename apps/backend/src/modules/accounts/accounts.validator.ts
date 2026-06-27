import { z } from 'zod';

export const createAccountSchema = z.object({
  account_code: z.string().min(1, 'account_code is required').max(20),
  name: z.string().min(1, 'name is required').max(150),
  account_type: z.enum(['asset', 'liability', 'income', 'expense', 'equity']),
  parent_id: z.string().uuid().optional().nullable(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const accountIdParamSchema = z.object({
  id: z.string().uuid('Invalid account ID'),
});

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const accountLedgerQuerySchema = z.object({
  from: z.string().regex(dateRegex, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(dateRegex, 'to must be YYYY-MM-DD').optional(),
});
