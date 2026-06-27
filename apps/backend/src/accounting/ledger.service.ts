import { v4 as uuidv4 } from 'uuid';
import type { Knex } from 'knex';
import db from '../config/database';
import { BadRequestError } from '../utils/errors';
import { roundPaise } from '../utils/money';
import { DEFAULT_CHART_OF_ACCOUNTS } from './coa';

/**
 * Double-entry General Ledger core (Sprint 18).
 *
 * Every money event posts a single balanced journal entry through `postJournal`
 * inside the caller's transaction. `chart_of_accounts` is the catalogue of
 * accounts; `journal_lines` are the immutable debit/credit legs.
 */

export interface JournalLineInput {
  /** Reference an account by its stable system code (preferred for hooks). */
  account_code?: string;
  /** Or reference directly by id (used by the manual-journal API). */
  account_id?: string;
  debit?: number; // paise
  credit?: number; // paise
}

export interface PostJournalParams {
  tenantId: string;
  branchId?: string | null;
  entryDate?: string; // YYYY-MM-DD, defaults to today
  narration: string;
  referenceType: string; // invoice | payment | purchase | expense | manual
  referenceId?: string | null;
  createdBy?: string | null;
  lines: JournalLineInput[];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function conn(trx?: Knex.Transaction) {
  return trx ?? db;
}

/**
 * Idempotently seed the default chart of accounts for a tenant. Safe to call
 * repeatedly: only missing account codes are inserted.
 */
export async function ensureChartOfAccounts(
  tenantId: string,
  trx?: Knex.Transaction
): Promise<void> {
  const c = conn(trx);
  const existing = await c('chart_of_accounts')
    .where({ tenant_id: tenantId })
    .select('account_code');
  const have = new Set(existing.map((r: { account_code: string }) => r.account_code));

  const toInsert = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => !have.has(a.account_code)).map((a) => ({
    id: uuidv4(),
    tenant_id: tenantId,
    account_code: a.account_code,
    name: a.name,
    account_type: a.account_type,
    parent_id: null,
    is_system: true,
    is_active: true,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  if (toInsert.length > 0) {
    await c('chart_of_accounts').insert(toInsert);
  }
}

/** Resolve a set of account codes → ids, seeding the COA on demand if needed. */
async function resolveCodes(
  tenantId: string,
  codes: string[],
  trx?: Knex.Transaction
): Promise<Map<string, string>> {
  const c = conn(trx);
  const lookup = async () =>
    c('chart_of_accounts')
      .where({ tenant_id: tenantId, is_deleted: false })
      .whereIn('account_code', codes)
      .select('account_code', 'id');

  let rows = await lookup();
  if (rows.length < codes.length) {
    // A required system account is missing (e.g. a tenant created before the
    // GL existed) — seed and retry once.
    await ensureChartOfAccounts(tenantId, trx);
    rows = await lookup();
  }

  const map = new Map<string, string>();
  for (const r of rows as { account_code: string; id: string }[]) map.set(r.account_code, r.id);
  return map;
}

/**
 * Post a balanced double-entry journal. Throws BadRequestError unless
 * SUM(debit) === SUM(credit) and the entry is non-zero. Returns the entry id.
 */
export async function postJournal(
  trx: Knex.Transaction,
  params: PostJournalParams
): Promise<string> {
  const { tenantId } = params;

  // Resolve any code-based lines to account ids.
  const codes = params.lines
    .map((l) => l.account_code)
    .filter((x): x is string => !!x);
  const codeMap = codes.length ? await resolveCodes(tenantId, [...new Set(codes)], trx) : new Map();

  let totalDebit = 0;
  let totalCredit = 0;

  const resolved = params.lines.map((line) => {
    const accountId = line.account_id ?? (line.account_code ? codeMap.get(line.account_code) : undefined);
    if (!accountId) {
      throw new BadRequestError(`Unknown ledger account: ${line.account_code ?? line.account_id}`);
    }

    const debit = roundPaise(line.debit ?? 0);
    const credit = roundPaise(line.credit ?? 0);

    if (debit < 0 || credit < 0) {
      throw new BadRequestError('Journal amounts cannot be negative');
    }
    if (debit > 0 && credit > 0) {
      throw new BadRequestError('A journal line cannot have both a debit and a credit');
    }
    if (debit === 0 && credit === 0) {
      throw new BadRequestError('A journal line must have a non-zero debit or credit');
    }

    totalDebit += debit;
    totalCredit += credit;
    return { accountId, debit, credit };
  });

  if (resolved.length < 2) {
    throw new BadRequestError('A journal entry requires at least two lines');
  }
  if (totalDebit !== totalCredit) {
    throw new BadRequestError(
      `Journal does not balance: debit ${totalDebit} ≠ credit ${totalCredit}`
    );
  }
  if (totalDebit === 0) {
    throw new BadRequestError('A journal entry cannot be zero-valued');
  }

  const entryId = uuidv4();
  const now = new Date().toISOString();

  await trx('journal_entries').insert({
    id: entryId,
    tenant_id: tenantId,
    branch_id: params.branchId ?? null,
    entry_date: params.entryDate ?? todayISO(),
    narration: params.narration,
    reference_type: params.referenceType,
    reference_id: params.referenceId ?? null,
    status: 'posted',
    created_by: params.createdBy ?? null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  });

  await trx('journal_lines').insert(
    resolved.map((r) => ({
      id: uuidv4(),
      tenant_id: tenantId,
      journal_entry_id: entryId,
      account_id: r.accountId,
      debit: r.debit,
      credit: r.credit,
      created_at: now,
    }))
  );

  return entryId;
}
