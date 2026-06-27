import { v4 as uuidv4 } from 'uuid';
import { AccountRepository } from '../../repositories/account.repo';
import { JournalRepository } from '../../repositories/journal.repo';
import { ensureChartOfAccounts } from '../../accounting/ledger.service';
import { NotFoundError, ConflictError } from '../../utils/errors';
import type { ChartOfAccount } from '@dhanlekha/shared';
import type { CreateAccountInput } from './accounts.validator';

export interface AccountNode extends ChartOfAccount {
  children: AccountNode[];
}

/**
 * Return the tenant's chart of accounts as a tree (parent → children). Seeds
 * the default accounts on first access so the GL is always usable.
 */
export async function getChartOfAccounts(tenantId: string): Promise<AccountNode[]> {
  await ensureChartOfAccounts(tenantId);
  const repo = new AccountRepository(tenantId);
  const accounts = await repo.listAll();

  const byId = new Map<string, AccountNode>();
  for (const a of accounts) byId.set(a.id, { ...a, children: [] });

  const roots: AccountNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Create a custom ledger account (admin). */
export async function createAccount(
  tenantId: string,
  data: CreateAccountInput
): Promise<ChartOfAccount> {
  await ensureChartOfAccounts(tenantId);
  const repo = new AccountRepository(tenantId);

  const existing = await repo.findByCode(data.account_code);
  if (existing) {
    throw new ConflictError(`Account code '${data.account_code}' already exists`);
  }

  if (data.parent_id) {
    const parent = await repo.findById(data.parent_id);
    if (!parent) throw new NotFoundError('Parent account');
  }

  const account: ChartOfAccount = {
    id: uuidv4(),
    tenant_id: tenantId,
    account_code: data.account_code,
    name: data.name,
    account_type: data.account_type,
    parent_id: data.parent_id ?? null,
    is_system: false,
    is_active: true,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await repo.create(account);
  return account;
}

/**
 * Account ledger with running balance. Balance direction follows the account's
 * normal balance: assets/expenses increase on debit; liabilities/income/equity
 * increase on credit.
 */
export async function getAccountLedger(
  tenantId: string,
  accountId: string,
  filters: { from?: string; to?: string }
) {
  const repo = new AccountRepository(tenantId);
  const account = await repo.findById(accountId);
  if (!account) throw new NotFoundError('Account');

  const debitNormal = account.account_type === 'asset' || account.account_type === 'expense';

  const rows = await new JournalRepository(tenantId).accountLedger(accountId, filters);

  let running = 0;
  const entries = rows.map((r) => {
    const debit = Number(r.debit);
    const credit = Number(r.credit);
    running += debitNormal ? debit - credit : credit - debit;
    return { ...r, debit, credit, running_balance: running };
  });

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return {
    account: {
      id: account.id,
      account_code: account.account_code,
      name: account.name,
      account_type: account.account_type,
    },
    total_debit: totalDebit,
    total_credit: totalCredit,
    closing_balance: running,
    entries,
  };
}
