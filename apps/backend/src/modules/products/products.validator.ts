import { z } from 'zod';

// Validator for creating a new product + initial inventory
export const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(200),
  barcode: z.string().max(50).optional().nullable(),
  gst_rate: z.number().min(0).max(100).default(0),
  hsn_code: z.string().max(20).optional().nullable(),
  base_unit: z.string().min(1).max(20).default('pcs'),
  category: z.string().max(100).optional().nullable(),
  
  // Initial inventory details
  initial_quantity: z.number().min(0).default(0),
  selling_price: z.number().min(0), // In paise
  purchase_price: z.number().min(0).default(0), // In paise
  min_stock_alert: z.number().min(0).default(0),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// Validator for updating a product (catalogue info only)
export const updateProductSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  barcode: z.string().max(50).optional().nullable(),
  gst_rate: z.number().min(0).max(100).optional(),
  hsn_code: z.string().max(20).optional().nullable(),
  base_unit: z.string().min(1).max(20).optional(),
  category: z.string().max(100).optional().nullable(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Validator for manually adjusting inventory stock
export const adjustInventorySchema = z.object({
  quantity_change: z.number(), // Can be positive or negative
  notes: z.string().min(3, 'Please provide a reason for the adjustment').max(500),
});

export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;

// Common parameter schemas
export const productIdParamSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
});

export const barcodeParamSchema = z.object({
  code: z.string().min(1, 'Barcode is required'),
});
