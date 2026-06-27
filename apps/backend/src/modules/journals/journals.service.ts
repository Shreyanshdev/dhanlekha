import { JournalRepository } from '../../repositories/journal.repo';
import { AccountRepository } from '../../repositories/account.repo';
import { postJournal } from '../../accounting/ledger.service';
import { withTransaction } from '../../database/transaction';
import { NotFoundError } from '../../utils/errors';
import type { JournalEntry, JournalLine } from '@dhanlekha/shared';
import type { CreateJournalInput } from './journals.validator';

/** List journal entries (paginated) with their lines attached. */
export async function listJournals(
  tenantId: string,
  page: number,
  limit: number,
  filters: { from?: string; to?: string; reference_type?: string; reference_id?: string }
): Promise<{ items: Array<JournalEntry & { lines: JournalLine[] }>; total: number }> {
  const repo = new JournalRepository(tenantId);
  const { items, total } = await repo.listEntries(page, limit, filters);

  const lines = await repo.linesForEntries(items.map((e) => e.id));
  const byEntry = new Map<string, JournalLine[]>();
  for (const l of lines) {
    const arr = byEntry.get(l.journal_entry_id) ?? [];
    arr.push(l);
    byEntry.set(l.journal_entry_id, arr);
  }

  return {
    items: items.map((e) => ({ ...e, lines: byEntry.get(e.id) ?? [] })),
    total,
  };
}

/**
 * Create a manual, balanced journal entry (admin). Validation (balance, line
 * shape) is enforced both by the Zod schema and `postJournal`.
 */
export async function createManualJournal(
  tenantId: string,
  branchId: string | null,
  userId: string,
  data: CreateJournalInput
): Promise<JournalEntry & { lines: JournalLine[] }> {
  // Verify every referenced account belongs to the tenant.
  const accountRepo = new AccountRepository(tenantId);
  for (const line of data.lines) {
    const acc = await accountRepo.findById(line.account_id);
    if (!acc) throw new NotFoundError(`Account ${line.account_id}`);
  }

  const entryId = await withTransaction((trx) =>
    postJournal(trx, {
      tenantId,
      branchId,
      entryDate: data.entry_date,
      narration: data.narration ?? 'Manual journal entry',
      referenceType: data.reference_type ?? 'manual',
      referenceId: data.reference_id ?? null,
      createdBy: userId,
      lines: data.lines.map((l) => ({
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit,
      })),
    })
  );

  const repo = new JournalRepository(tenantId);
  const entry = await repo.findEntryById(entryId);
  if (!entry) throw new NotFoundError('Journal entry');
  const lines = await repo.linesForEntries([entryId]);
  return { ...entry, lines };
}
