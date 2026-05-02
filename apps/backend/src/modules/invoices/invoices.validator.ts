import { z } from 'zod';

export const invoiceItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative().optional(),   // Optional: auto-fetched from inventory if missing (barcode scan flow)
  gst_rate: z.number().min(0).max(100).optional(),   // Optional: auto-fetched from product if missing (barcode scan flow)
  discount_amount: z.number().nonnegative().default(0),
});

export const createInvoiceSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'Invoice must have at least one item'),
  amount_paid: z.number().nonnegative().default(0),
  note: z.string().max(500).optional().nullable(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const invoiceIdParamSchema = z.object({
  id: z.string().uuid('Invalid invoice ID'),
});

export const invoiceQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  status: z.enum(['paid', 'partial', 'unpaid', 'cancelled']).optional(),
  customer_id: z.string().uuid().optional(),
});
