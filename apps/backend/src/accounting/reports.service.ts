import type { AccountType } from '@dhanlekha/shared';
import db from '../config/database';
import { ACCOUNTS } from './coa';
import { ensureChartOfAccounts } from './ledger.service';

/** Signed balance using normal-balance rules (same as accounts.service). */
export function signedBalance(
  accountType: AccountType,
  totalDebit: number,
  totalCredit: number
): number {
  const debitNormal = accountType === 'asset' || accountType === 'expense';
  return debitNormal ? totalDebit - totalCredit : totalCredit - totalDebit;
}

/** Split a signed balance into trial-balance debit/credit columns. */
export function trialBalanceColumns(
  accountType: AccountType,
  balance: number
): { debit: number; credit: number } {
  if (balance === 0) return { debit: 0, credit: 0 };
  const debitNormal = accountType === 'asset' || accountType === 'expense';
  if (balance > 0) {
    return debitNormal ? { debit: balance, credit: 0 } : { debit: 0, credit: balance };
  }
  const abs = Math.abs(balance);
  return debitNormal ? { debit: 0, credit: abs } : { debit: abs, credit: 0 };
}

export interface AccountActivityRow {
  account_id: string;
  account_code: string;
  name: string;
  account_type: AccountType;
  total_debit: number;
  total_credit: number;
}

export interface ReportPeriod {
  from: string;
  to: string;
  financial_year_id?: string;
}

interface RawOpeningRow {
  account_id: string;
  debit: number;
  credit: number;
}

/**
 * Aggregate posted journal activity per account. Supply `before` for opening
 * balances, or `from`/`to` for a period (inclusive dates).
 */
export async function aggregateAccountActivity(
  tenantId: string,
  opts: { before?: string; from?: string; to?: string }
): Promise<Map<string, { debit: number; credit: number }>> {
  const q = db('journal_lines as jl')
    .join('journal_entries as je', 'jl.journal_entry_id', 'je.id')
    .where('jl.tenant_id', tenantId)
    .where('je.tenant_id', tenantId)
    .where('je.is_deleted', false)
    .where('je.status', 'posted')
    .modify((b) => {
      if (opts.before) b.where('je.entry_date', '<', opts.before);
      if (opts.from) b.where('je.entry_date', '>=', opts.from);
      if (opts.to) b.where('je.entry_date', '<=', opts.to);
    })
    .groupBy('jl.account_id')
    .select('jl.account_id')
    .sum({ debit: 'jl.debit', credit: 'jl.credit' });

  const rows = await q;
  const map = new Map<string, { debit: number; credit: number }>();
  for (const r of rows as Array<{ account_id: string; debit: number | string; credit: number | string }>) {
    map.set(r.account_id, {
      debit: Number(r.debit ?? 0),
      credit: Number(r.credit ?? 0),
    });
  }
  return map;
}

/** Load all active accounts for the tenant (seeds COA if needed). */
export async function loadAccounts(tenantId: string): Promise<AccountActivityRow[]> {
  await ensureChartOfAccounts(tenantId);
  const rows = await db('chart_of_accounts')
    .where({ tenant_id: tenantId, is_deleted: false })
    .orderBy('account_code', 'asc')
    .select('id as account_id', 'account_code', 'name', 'account_type');

  return (rows as AccountActivityRow[]).map((r) => ({
    ...r,
    total_debit: 0,
    total_credit: 0,
  }));
}

async function loadOpeningBalances(
  tenantId: string,
  financialYearId: string
): Promise<Map<string, RawOpeningRow>> {
  const rows = await db('opening_balances')
    .where({ tenant_id: tenantId, financial_year_id: financialYearId })
    .select('account_id', 'debit', 'credit');

  const map = new Map<string, RawOpeningRow>();
  for (const r of rows as RawOpeningRow[]) {
    map.set(r.account_id, {
      account_id: r.account_id,
      debit: Number(r.debit),
      credit: Number(r.credit),
    });
  }
  return map;
}

/** Combine opening (FY table + pre-from journals) with period activity. */
export async function buildAccountSnapshots(
  tenantId: string,
  period: ReportPeriod
): Promise<
  Array<{
    account_id: string;
    account_code: string;
    name: string;
    account_type: AccountType;
    opening_debit: number;
    opening_credit: number;
    period_debit: number;
    period_credit: number;
    closing_debit: number;
    closing_credit: number;
    signed_opening: number;
    signed_closing: number;
  }>
> {
  const accounts = await loadAccounts(tenantId);

  const fyOpening = period.financial_year_id
    ? await loadOpeningBalances(tenantId, period.financial_year_id)
    : new Map<string, RawOpeningRow>();

  // When a financial year is selected, opening comes solely from opening_balances.
  // Otherwise derive opening from all journals before the period start.
  const prePeriod = period.financial_year_id
    ? new Map<string, { debit: number; credit: number }>()
    : await aggregateAccountActivity(tenantId, { before: period.from });
  const periodActivity = await aggregateAccountActivity(tenantId, {
    from: period.from,
    to: period.to,
  });

  return accounts.map((acc) => {
    const ob = fyOpening.get(acc.account_id) ?? { debit: 0, credit: 0 };
    const pre = prePeriod.get(acc.account_id) ?? { debit: 0, credit: 0 };

    const opening_debit = Number(ob.debit) + pre.debit;
    const opening_credit = Number(ob.credit) + pre.credit;
    const period_debit = periodActivity.get(acc.account_id)?.debit ?? 0;
    const period_credit = periodActivity.get(acc.account_id)?.credit ?? 0;
    const closing_debit = opening_debit + period_debit;
    const closing_credit = opening_credit + period_credit;

    return {
      account_id: acc.account_id,
      account_code: acc.account_code,
      name: acc.name,
      account_type: acc.account_type,
      opening_debit,
      opening_credit,
      period_debit,
      period_credit,
      closing_debit,
      closing_credit,
      signed_opening: signedBalance(acc.account_type, opening_debit, opening_credit),
      signed_closing: signedBalance(acc.account_type, closing_debit, closing_credit),
    };
  });
}

/** Cumulative activity up to and including `asOf` plus optional FY opening at start. */
export async function buildCumulativeSnapshots(
  tenantId: string,
  asOf: string,
  financialYearId?: string
): Promise<
  Array<{
    account_id: string;
    account_code: string;
    name: string;
    account_type: AccountType;
    total_debit: number;
    total_credit: number;
    signed_balance: number;
  }>
> {
  const accounts = await loadAccounts(tenantId);
  let fyStart: string | undefined;
  const fyOpening = financialYearId
    ? await loadOpeningBalances(tenantId, financialYearId)
    : new Map<string, RawOpeningRow>();

  if (financialYearId) {
    const fy = await db('financial_years')
      .where({ id: financialYearId, tenant_id: tenantId, is_deleted: false })
      .first();
    if (fy) fyStart = (fy as { start_date: string }).start_date;
  }

  const cumulative = await aggregateAccountActivity(tenantId, {
    from: fyStart,
    to: asOf,
  });

  return accounts.map((acc) => {
    const ob = fyOpening.get(acc.account_id) ?? { debit: 0, credit: 0 };
    const mov = cumulative.get(acc.account_id) ?? { debit: 0, credit: 0 };
    const total_debit = Number(ob.debit) + mov.debit;
    const total_credit = Number(ob.credit) + mov.credit;
    return {
      account_id: acc.account_id,
      account_code: acc.account_code,
      name: acc.name,
      account_type: acc.account_type,
      total_debit,
      total_credit,
      signed_balance: signedBalance(acc.account_type, total_debit, total_credit),
    };
  });
}

export async function getTrialBalance(tenantId: string, period: ReportPeriod) {
  const snapshots = await buildAccountSnapshots(tenantId, period);

  const lines = snapshots
    .filter((s) => s.signed_closing !== 0 || s.period_debit > 0 || s.period_credit > 0)
    .map((s) => {
      const cols = trialBalanceColumns(s.account_type, s.signed_closing);
      return {
        account_id: s.account_id,
        account_code: s.account_code,
        name: s.name,
        account_type: s.account_type,
        opening_balance: s.signed_opening,
        period_debit: s.period_debit,
        period_credit: s.period_credit,
        closing_debit: cols.debit,
        closing_credit: cols.credit,
      };
    });

  const total_debit = lines.reduce((sum, l) => sum + l.closing_debit, 0);
  const total_credit = lines.reduce((sum, l) => sum + l.closing_credit, 0);

  return {
    ...period,
    lines,
    total_debit,
    total_credit,
    is_balanced: total_debit === total_credit,
  };
}

export async function getProfitAndLoss(tenantId: string, period: ReportPeriod) {
  const snapshots = await buildAccountSnapshots(tenantId, period);

  const income = snapshots
    .filter((s) => s.account_type === 'income' && s.signed_closing !== 0)
    .map((s) => ({
      account_id: s.account_id,
      account_code: s.account_code,
      name: s.name,
      amount: s.signed_closing,
    }));

  const expenses = snapshots
    .filter((s) => s.account_type === 'expense' && s.signed_closing !== 0)
    .map((s) => ({
      account_id: s.account_id,
      account_code: s.account_code,
      name: s.name,
      amount: s.signed_closing,
    }));

  const total_income = income.reduce((s, r) => s + r.amount, 0);
  const total_expenses = expenses.reduce((s, r) => s + r.amount, 0);

  return {
    ...period,
    income,
    expenses,
    total_income,
    total_expenses,
    net_profit: total_income - total_expenses,
  };
}

export async function getBalanceSheet(
  tenantId: string,
  asOf: string,
  financialYearId?: string
) {
  const snapshots = await buildCumulativeSnapshots(tenantId, asOf, financialYearId);

  const assets = snapshots
    .filter((s) => s.account_type === 'asset' && s.signed_balance !== 0)
    .map((s) => ({
      account_id: s.account_id,
      account_code: s.account_code,
      name: s.name,
      balance: s.signed_balance,
    }));

  const liabilities = snapshots
    .filter((s) => s.account_type === 'liability' && s.signed_balance !== 0)
    .map((s) => ({
      account_id: s.account_id,
      account_code: s.account_code,
      name: s.name,
      balance: s.signed_balance,
    }));

  const equityAccounts = snapshots
    .filter((s) => s.account_type === 'equity' && s.signed_balance !== 0)
    .map((s) => ({
      account_id: s.account_id,
      account_code: s.account_code,
      name: s.name,
      balance: s.signed_balance,
    }));

  const incomeTotal = snapshots
    .filter((s) => s.account_type === 'income')
    .reduce((s, r) => s + r.signed_balance, 0);
  const expenseTotal = snapshots
    .filter((s) => s.account_type === 'expense')
    .reduce((s, r) => s + r.signed_balance, 0);
  const surplus = incomeTotal - expenseTotal;

  const equity = [...equityAccounts];
  if (surplus !== 0) {
    equity.push({
      account_id: 'surplus',
      account_code: 'SURPLUS',
      name: surplus >= 0 ? 'Surplus / Retained Earnings' : 'Deficit',
      balance: surplus,
    });
  }

  const total_assets = assets.reduce((s, r) => s + r.balance, 0);
  const total_liabilities = liabilities.reduce((s, r) => s + r.balance, 0);
  const total_equity = equity.reduce((s, r) => s + r.balance, 0);

  return {
    as_of: asOf,
    financial_year_id: financialYearId ?? null,
    assets,
    liabilities,
    equity,
    total_assets,
    total_liabilities,
    total_equity,
    total_liabilities_and_equity: total_liabilities + total_equity,
    is_balanced: total_assets === total_liabilities + total_equity,
  };
}

export async function getCashFlow(tenantId: string, period: ReportPeriod) {
  await ensureChartOfAccounts(tenantId);

  const cashAccounts = await db('chart_of_accounts')
    .where({ tenant_id: tenantId, is_deleted: false })
    .whereIn('account_code', [ACCOUNTS.CASH, ACCOUNTS.BANK])
    .select('id', 'account_code', 'name');

  const accountIds = (cashAccounts as Array<{ id: string }>).map((a) => a.id);
  if (accountIds.length === 0) {
    return {
      ...period,
      opening_cash: 0,
      inflows: 0,
      outflows: 0,
      closing_cash: 0,
      by_reference_type: [],
    };
  }

  const pre = await db('journal_lines as jl')
    .join('journal_entries as je', 'jl.journal_entry_id', 'je.id')
    .where('jl.tenant_id', tenantId)
    .whereIn('jl.account_id', accountIds)
    .where('je.is_deleted', false)
    .where('je.status', 'posted')
    .where('je.entry_date', '<', period.from)
    .sum({ debit: 'jl.debit', credit: 'jl.credit' })
    .first();

  const opening_cash =
    Number((pre as { debit?: number | string })?.debit ?? 0) -
    Number((pre as { credit?: number | string })?.credit ?? 0);

  const periodRows = await db('journal_lines as jl')
    .join('journal_entries as je', 'jl.journal_entry_id', 'je.id')
    .where('jl.tenant_id', tenantId)
    .whereIn('jl.account_id', accountIds)
    .where('je.is_deleted', false)
    .where('je.status', 'posted')
    .where('je.entry_date', '>=', period.from)
    .where('je.entry_date', '<=', period.to)
    .groupBy('je.reference_type')
    .select('je.reference_type')
    .sum({ debit: 'jl.debit', credit: 'jl.credit' });

  let inflows = 0;
  let outflows = 0;
  const by_reference_type: Array<{
    reference_type: string;
    inflow: number;
    outflow: number;
    net: number;
  }> = [];

  for (const r of periodRows as Array<{
    reference_type: string;
    debit: number | string;
    credit: number | string;
  }>) {
    const debit = Number(r.debit ?? 0);
    const credit = Number(r.credit ?? 0);
    inflows += debit;
    outflows += credit;
    by_reference_type.push({
      reference_type: r.reference_type,
      inflow: debit,
      outflow: credit,
      net: debit - credit,
    });
  }

  return {
    ...period,
    opening_cash,
    inflows,
    outflows,
    closing_cash: opening_cash + inflows - outflows,
    by_reference_type,
  };
}

export async function getDayBook(tenantId: string, period: ReportPeriod) {
  const entries = await db('journal_entries')
    .where({ tenant_id: tenantId, is_deleted: false, status: 'posted' })
    .where('entry_date', '>=', period.from)
    .where('entry_date', '<=', period.to)
    .orderBy('entry_date', 'asc')
    .orderBy('created_at', 'asc');

  if ((entries as unknown[]).length === 0) {
    return { ...period, entries: [] };
  }

  const entryIds = (entries as Array<{ id: string }>).map((e) => e.id);
  const lines = await db('journal_lines as jl')
    .join('chart_of_accounts as coa', 'jl.account_id', 'coa.id')
    .where('jl.tenant_id', tenantId)
    .whereIn('jl.journal_entry_id', entryIds)
    .select(
      'jl.journal_entry_id',
      'jl.account_id',
      'coa.account_code',
      'coa.name as account_name',
      'jl.debit',
      'jl.credit'
    );

  const linesByEntry = new Map<string, typeof lines>();
  for (const l of lines as Array<{ journal_entry_id: string }>) {
    const arr = linesByEntry.get(l.journal_entry_id) ?? [];
    arr.push(l);
    linesByEntry.set(l.journal_entry_id, arr);
  }

  return {
    ...period,
    entries: (entries as Array<Record<string, unknown>>).map((e) => ({
      ...e,
      lines: (linesByEntry.get(e.id as string) ?? []).map((l: any) => ({
        account_id: l.account_id,
        account_code: l.account_code,
        account_name: l.account_name,
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    })),
  };
}

/** Convert signed balance to opening debit/credit for roll-forward. */
export function signedToOpeningColumns(
  accountType: AccountType,
  balance: number
): { debit: number; credit: number } {
  if (balance === 0) return { debit: 0, credit: 0 };
  const cols = trialBalanceColumns(accountType, balance);
  return { debit: cols.debit, credit: cols.credit };
}

export async function computeClosingOpeningRows(
  tenantId: string,
  asOf: string
): Promise<Array<{ account_id: string; debit: number; credit: number }>> {
  const snapshots = await buildCumulativeSnapshots(tenantId, asOf);
  return snapshots
    .filter((s) => s.signed_balance !== 0)
    .map((s) => {
      const { debit, credit } = signedToOpeningColumns(s.account_type, s.signed_balance);
      return { account_id: s.account_id, debit, credit };
    });
}
