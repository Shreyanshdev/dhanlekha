import type { AccountType } from '@dhanlekha/shared';

/**
 * Stable account codes for the system accounts that the posting hooks depend
 * on. Codes (not ids) are referenced in code so the GL is portable across
 * tenants — each tenant gets its own row per code via `ensureChartOfAccounts`.
 */
export const ACCOUNTS = {
  CASH: '1000',
  BANK: '1010',
  ACCOUNTS_RECEIVABLE: '1100',
  GST_INPUT_CREDIT: '1200',
  INVENTORY: '1300',
  ACCOUNTS_PAYABLE: '2000',
  GST_OUTPUT_PAYABLE: '2100',
  CAPITAL: '3000',
  SALES: '4000',
  PURCHASES: '5000',
  DISCOUNTS_ALLOWED: '5100',
  GENERAL_EXPENSE: '6000',
} as const;

export interface DefaultAccount {
  account_code: string;
  name: string;
  account_type: AccountType;
}

/** The default chart of accounts seeded for every tenant on registration. */
export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  { account_code: ACCOUNTS.CASH, name: 'Cash', account_type: 'asset' },
  { account_code: ACCOUNTS.BANK, name: 'Bank', account_type: 'asset' },
  { account_code: ACCOUNTS.ACCOUNTS_RECEIVABLE, name: 'Accounts Receivable', account_type: 'asset' },
  { account_code: ACCOUNTS.GST_INPUT_CREDIT, name: 'GST Input Credit', account_type: 'asset' },
  { account_code: ACCOUNTS.INVENTORY, name: 'Inventory', account_type: 'asset' },
  { account_code: ACCOUNTS.ACCOUNTS_PAYABLE, name: 'Accounts Payable', account_type: 'liability' },
  { account_code: ACCOUNTS.GST_OUTPUT_PAYABLE, name: 'GST Output Payable', account_type: 'liability' },
  { account_code: ACCOUNTS.CAPITAL, name: 'Capital', account_type: 'equity' },
  { account_code: ACCOUNTS.SALES, name: 'Sales', account_type: 'income' },
  { account_code: ACCOUNTS.PURCHASES, name: 'Purchases', account_type: 'expense' },
  { account_code: ACCOUNTS.DISCOUNTS_ALLOWED, name: 'Discounts Allowed', account_type: 'expense' },
  { account_code: ACCOUNTS.GENERAL_EXPENSE, name: 'General Expense', account_type: 'expense' },
];

/** Map a payment mode to the cash/bank settlement account code. */
export function settlementAccountForMode(mode?: string | null): string {
  return mode === 'cash' || mode == null ? ACCOUNTS.CASH : ACCOUNTS.BANK;
}
