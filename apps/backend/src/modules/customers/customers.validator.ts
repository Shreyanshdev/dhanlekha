import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be a 10 digit number').optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  credit_limit: z.number().min(0).default(0),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\d{10}$/).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  credit_limit: z.number().min(0).optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerIdParamSchema = z.object({
  id: z.string().uuid('Invalid customer ID'),
});
