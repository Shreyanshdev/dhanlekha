import { z } from 'zod';

export const registerSchema = z.object({
  tenantName: z.string().min(2, 'Tenant name must be at least 2 characters').max(100),
  tenantEmail: z.string().email('Invalid email format'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be a 10 digit number').optional(),
  planId: z.enum(['starter', 'growth', 'enterprise']).default('starter'),

  userName: z.string().min(2, 'User name must be at least 2 characters').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});
