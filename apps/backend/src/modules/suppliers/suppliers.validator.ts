import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be a 10 digit number').optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  gst_number: z.string().max(15).optional().nullable(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\d{10}$/).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  gst_number: z.string().max(15).optional().nullable(),
});

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const supplierIdParamSchema = z.object({
  id: z.string().uuid('Invalid supplier ID'),
});
