import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const journalLineSchema = z
  .object({
    account_id: z.string().uuid('account_id must be a valid account'),
    debit: z.number().int().min(0).default(0),
    credit: z.number().int().min(0).default(0),
  })
  .refine((l) => !(l.debit > 0 && l.credit > 0), {
    message: 'A line cannot have both a debit and a credit',
  })
  .refine((l) => l.debit > 0 || l.credit > 0, {
    message: 'A line must have a non-zero debit or credit',
  });

export const createJournalSchema = z
  .object({
    entry_date: z.string().regex(dateRegex, 'entry_date must be YYYY-MM-DD').optional(),
    narration: z.string().max(500).optional().nullable(),
    reference_type: z.string().max(40).optional(),
    reference_id: z.string().uuid().optional().nullable(),
    lines: z.array(journalLineSchema).min(2, 'A journal entry requires at least two lines'),
  })
  .refine(
    (data) => {
      const debit = data.lines.reduce((s, l) => s + l.debit, 0);
      const credit = data.lines.reduce((s, l) => s + l.credit, 0);
      return debit === credit && debit > 0;
    },
    { message: 'Journal must balance: total debit must equal total credit (and be non-zero)', path: ['lines'] }
  );

export type CreateJournalInput = z.infer<typeof createJournalSchema>;

export const journalQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  from: z.string().regex(dateRegex).optional(),
  to: z.string().regex(dateRegex).optional(),
  reference_type: z.string().max(40).optional(),
  reference_id: z.string().uuid().optional(),
});
