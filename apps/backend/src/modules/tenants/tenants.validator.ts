import { z } from 'zod';

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be a 10 digit number').optional(),
});
