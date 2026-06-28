import { z } from 'zod';

const allocationSchema = z.object({
  purchase_id: z.string().uuid('Invalid purchase ID'),
  allocated_amount: z.number().positive('Allocated amount must be > 0'),
});

export const createSupplierPaymentSchema = z.object({
  supplier_id: z.string().uuid('Invalid supplier ID'),

  amount: z.number().positive('Amount must be > 0'),

  payment_mode: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque']),

  allocations: z
    .array(allocationSchema)
    .optional()
    .default([]),

  reference_number: z.string().max(100).optional().nullable(),
  note: z.string().max(500).optional().nullable(),

  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'payment_date must be YYYY-MM-DD format')
    .optional(),
});

export const allocateSupplierPaymentSchema = z.object({
  allocations: z
    .array(allocationSchema)
    .min(1, 'At least one allocation is required'),
});

export const supplierPaymentIdParamSchema = z.object({
  id: z.string().uuid('Invalid supplier payment ID'),
});

export const listSupplierPaymentsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  supplier_id: z.string().uuid().optional(),
  status: z.enum(['received', 'fully_allocated', 'partially_allocated']).optional(),
  payment_mode: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque']).optional(),
});

export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;
export type AllocateSupplierPaymentInput = z.infer<typeof allocateSupplierPaymentSchema>;
