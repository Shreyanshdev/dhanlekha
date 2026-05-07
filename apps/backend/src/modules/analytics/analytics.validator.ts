import { z } from 'zod';

export const getDailyAnalyticsSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  branch_id: z.string().uuid().optional()
});

export const getDashboardSchema = z.object({
  branch_id: z.string().uuid().optional()
});

export type GetDailyAnalyticsInput = z.infer<typeof getDailyAnalyticsSchema>;
export type GetDashboardInput = z.infer<typeof getDashboardSchema>;
