import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const createFinancialYearSchema = z
  .object({
    name: z.string().min(2).max(100),
    start_date: dateStr,
    end_date: dateStr,
  })
  .refine((d) => d.start_date <= d.end_date, {
    message: 'start_date must be on or before end_date',
  });

export const financialYearIdParamSchema = z.object({
  id: z.string().uuid('Invalid financial year ID'),
});

export const closeFinancialYearSchema = z.object({
  next_year: z
    .object({
      name: z.string().min(2).max(100),
      start_date: dateStr,
      end_date: dateStr,
    })
    .optional(),
});

export type CreateFinancialYearInput = z.infer<typeof createFinancialYearSchema>;
export type CloseFinancialYearInput = z.infer<typeof closeFinancialYearSchema>;
