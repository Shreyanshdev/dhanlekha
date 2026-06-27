import db from '../config/database';
import type { Knex } from 'knex';
import type { JournalEntry, JournalLine } from '@dhanlekha/shared';

/**
 * Repository for journal entries + lines. Postings are written by
 * `accounting/ledger.service.postJournal`; this repo handles read paths for the
 * accounts/journals APIs.
 */
export class JournalRepository {
  private tenantId: string;
  private trx?: Knex.Transaction;

  constructor(tenantId: string, trx?: Knex.Transaction) {
    this.tenantId = tenantId;
    this.trx = trx;
  }

  private entries(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx('journal_entries') : db('journal_entries');
    return qb.where({ tenant_id: this.tenantId, is_deleted: false });
  }

  private lines(): Knex.QueryBuilder {
    return this.trx ? this.trx('journal_lines') : db('journal_lines');
  }

  /** Paginated journal entries with optional filters, newest first. */
  async listEntries(
    page: number,
    limit: number,
    filters: { from?: string; to?: string; reference_type?: string; reference_id?: string } = {}
  ): Promise<{ items: JournalEntry[]; total: number }> {
    const base = this.entries().where((b) => {
      if (filters.from) b.where('entry_date', '>=', filters.from);
      if (filters.to) b.where('entry_date', '<=', filters.to);
      if (filters.reference_type) b.where('reference_type', filters.reference_type);
      if (filters.reference_id) b.where('reference_id', filters.reference_id);
    });

    const totalQuery = base.clone().clearSelect().clearOrder().count('id as count').first() as any;
    const itemsQuery = base
      .clone()
      .orderBy('entry_date', 'desc')
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit);

    const [totalRes, items] = await Promise.all([totalQuery, itemsQuery]);
    return { items, total: Number(totalRes?.count ?? 0) };
  }

  /** Fetch a single journal entry header by id. */
  async findEntryById(entryId: string): Promise<JournalEntry | undefined> {
    return await this.entries().where({ id: entryId }).first();
  }

  /** Fetch the lines for a set of journal entries. */
  async linesForEntries(entryIds: string[]): Promise<JournalLine[]> {
    if (entryIds.length === 0) return [];
    return await this.lines()
      .where({ tenant_id: this.tenantId })
      .whereIn('journal_entry_id', entryIds);
  }

  /**
   * Account ledger: every line touching `accountId` within an optional date
   * range, oldest first, joined to its entry for date/narration/reference.
   */
  async accountLedger(
    accountId: string,
    filters: { from?: string; to?: string } = {}
  ): Promise<
    Array<{
      journal_entry_id: string;
      entry_date: string;
      narration: string | null;
      reference_type: string;
      reference_id: string | null;
      debit: number;
      credit: number;
    }>
  > {
    const q = this.lines()
      .join('journal_entries', 'journal_lines.journal_entry_id', 'journal_entries.id')
      .where('journal_lines.tenant_id', this.tenantId)
      .where('journal_lines.account_id', accountId)
      .where('journal_entries.is_deleted', false)
      .where('journal_entries.status', 'posted')
      .modify((b) => {
        if (filters.from) b.where('journal_entries.entry_date', '>=', filters.from);
        if (filters.to) b.where('journal_entries.entry_date', '<=', filters.to);
      })
      .orderBy('journal_entries.entry_date', 'asc')
      .orderBy('journal_entries.created_at', 'asc')
      .select(
        'journal_lines.journal_entry_id as journal_entry_id',
        'journal_entries.entry_date as entry_date',
        'journal_entries.narration as narration',
        'journal_entries.reference_type as reference_type',
        'journal_entries.reference_id as reference_id',
        'journal_lines.debit as debit',
        'journal_lines.credit as credit'
      );

    return await q;
  }
}
