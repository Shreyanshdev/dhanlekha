import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const reportQuerySchema = z
  .object({
    from: dateStr.optional(),
    to: dateStr.optional(),
    financial_year_id: z.string().uuid().optional(),
    as_of: dateStr.optional(),
  })
  .refine((d) => d.from || d.to || d.financial_year_id || d.as_of, {
    message: 'Provide from/to, financial_year_id, or as_of',
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;
