import { z } from 'zod';

export const listAlertsSchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('50'),
  branch_id: z.string().uuid().optional(),
  is_read: z.enum(['true', 'false']).optional(),
  alert_type: z.enum(['low_stock', 'payment_due', 'high_demand', 'expiry_soon', 'sync_failed']).optional()
});

export type ListAlertsInput = z.infer<typeof listAlertsSchema>;
