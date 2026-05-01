import { z } from 'zod';

export const registerSchema = z.object({
  tenantName: z.string().min(2).max(100),
  tenantEmail: z.string().email(),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be a 10 digit number').optional(),
  planId: z.enum(['starter', 'growth', 'enterprise']).default('starter'),
  
  userName: z.string().min(2).max(100),
  password: z.string().min(6),
});
