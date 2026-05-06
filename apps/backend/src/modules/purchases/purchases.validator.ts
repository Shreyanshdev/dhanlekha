import { z } from 'zod';

export const createPurchaseSchema = z.object({
  branch_id: z.string().uuid('Invalid branch ID'),
  supplier_id: z.string().uuid('Invalid supplier ID'),
  supplier_invoice_number: z.string().max(100).optional().nullable(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'purchase_date must be YYYY-MM-DD').optional(),
  
  subtotal: z.number().min(0),
  tax_amount: z.number().min(0).default(0),
  discount_amount: z.number().min(0).default(0),
  total_amount: z.number().min(0),
  paid_amount: z.number().min(0).default(0),
  
  notes: z.string().max(500).optional().nullable(),
  
  items: z.array(z.object({
    product_id: z.string().uuid('Invalid product ID'),
    quantity: z.number().positive('Quantity must be positive'),
    purchase_price: z.number().min(0), // Updated name
    tax_rate: z.number().min(0).max(100).default(0),
    tax_amount: z.number().min(0).default(0),
    total: z.number().min(0),          // Updated name
    batch_number: z.string().max(50).optional().nullable(),
    expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  })).min(1, 'At least one item is required'),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export const purchaseQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  branch_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
