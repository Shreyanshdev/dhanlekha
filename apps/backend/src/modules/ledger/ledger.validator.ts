import { z } from 'zod';

// ── Manual Ledger Adjustment (admin only) ─────────────────────────────
export const createAdjustmentSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),

  // Exactly one of debit or credit must be positive (the other 0)
  debit: z.number().min(0, 'Debit must be >= 0').default(0),
  credit: z.number().min(0, 'Credit must be >= 0').default(0),

  notes: z.string().min(3, 'Notes are required for adjustments').max(500),
}).refine(
  (data) => (data.debit > 0 && data.credit === 0) || (data.credit > 0 && data.debit === 0),
  { message: 'Exactly one of debit or credit must be positive', path: ['debit'] }
);

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;

// ── Ledger query params ───────────────────────────────────────────────
export const ledgerQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
  entry_type: z.enum(['invoice', 'payment', 'adjustment']).optional(),
});

export const customerIdParamSchema = z.object({
  id: z.string().uuid('Invalid customer ID'),
});
