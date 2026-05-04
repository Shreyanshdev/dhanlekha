import { z } from 'zod';

// ── Single allocation: link a payment to one invoice ──────────────────
const allocationSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  allocated_amount: z.number().positive('Allocated amount must be > 0'),
});

// ── Record Payment ────────────────────────────────────────────────────
export const createPaymentSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID').optional().nullable(),

  amount: z.number().positive('Amount must be > 0'),

  payment_mode: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque']),

  // Optional: allocate to specific invoices at the time of payment
  // If omitted, the full amount stays as unallocated (advance credit)
  allocations: z
    .array(allocationSchema)
    .optional()
    .default([]),

  reference_number: z.string().max(100).optional().nullable(),
  note: z.string().max(500).optional().nullable(),

  // YYYY-MM-DD format; defaults to today if not provided
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'payment_date must be YYYY-MM-DD format')
    .optional(),
});

// ── Allocate an existing payment to invoices ──────────────────────────
export const allocatePaymentSchema = z.object({
  allocations: z
    .array(allocationSchema)
    .min(1, 'At least one allocation is required'),
});

// ── Params & Query ────────────────────────────────────────────────────
export const paymentIdParamSchema = z.object({
  id: z.string().uuid('Invalid payment ID'),
});

export const listPaymentsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  customer_id: z.string().uuid().optional(),
  status: z.enum(['received', 'fully_allocated', 'partially_allocated']).optional(),
  payment_mode: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque']).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type AllocatePaymentInput = z.infer<typeof allocatePaymentSchema>;
