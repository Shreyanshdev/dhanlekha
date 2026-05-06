import { v4 as uuidv4 } from 'uuid';
import { CustomerRepository } from '../../repositories/customer.repo';
import { withTransaction } from '../../database/transaction';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import type { CustomerLedger } from '@dhanlekha/shared';
import type { CreateAdjustmentInput } from './ledger.validator';

/**
 * Get paginated ledger entries for a customer.
 */
export async function getCustomerLedger(
  tenantId: string,
  customerId: string,
  page: number,
  limit: number,
  filters: { from?: string; to?: string; entry_type?: string } = {}
): Promise<{ items: CustomerLedger[]; total: number }> {
  const customerRepo = new CustomerRepository(tenantId);
  const customer = await customerRepo.findById(customerId);
  if (!customer) throw new NotFoundError('Customer');

  return await customerRepo.getLedgerPaged(customerId, page, limit, filters);
}

/**
 * Get balance summary with integrity verification.
 */
export async function getCustomerBalance(
  tenantId: string,
  customerId: string
) {
  const customerRepo = new CustomerRepository(tenantId);
  const customer = await customerRepo.findById(customerId);
  if (!customer) throw new NotFoundError('Customer');

  const summary = await customerRepo.getBalanceSummary(customerId);

  return {
    customer_id: customerId,
    customer_name: customer.name,
    credit_limit: Number(customer.credit_limit),
    ...summary,
  };
}

/**
 * Create a manual ledger adjustment (admin only).
 *
 * Atomic workflow:
 *  1. Validate customer exists
 *  2. Get latest running_balance
 *  3. Compute new running_balance = old + debit - credit
 *  4. INSERT customer_ledger entry (entry_type = 'adjustment')
 *  5. UPDATE customers.total_due accordingly
 */
export async function createAdjustment(
  tenantId: string,
  userId: string,
  data: CreateAdjustmentInput
): Promise<CustomerLedger> {
  return await withTransaction(async (trx) => {
    const customerRepo = new CustomerRepository(tenantId, trx);

    // Step 1: Validate customer
    const customer = await customerRepo.findById(data.customer_id);
    if (!customer) throw new NotFoundError('Customer');

    // Step 2: Get latest running balance (locked)
    const latestEntry = await customerRepo.getLatestLedgerEntry(data.customer_id);
    const currentBalance = latestEntry
      ? Number(latestEntry.running_balance)
      : Number(customer.total_due);

    // Step 3: Compute new balance
    const newBalance = currentBalance + data.debit - data.credit;

    // Guard: prevent negative balance from credit adjustments
    // (a negative balance means we owe the customer — that's allowed for advances)

    // Step 4: INSERT ledger entry
    const entryId = uuidv4();
    const entry: Partial<CustomerLedger> = {
      id: entryId,
      tenant_id: tenantId,
      customer_id: data.customer_id,
      entry_type: 'adjustment',
      reference_id: entryId, // Self-referencing for adjustments
      debit: data.debit,
      credit: data.credit,
      running_balance: newBalance,
      notes: data.notes,
      created_by: userId,
    };

    await customerRepo.addLedgerEntry(entry);

    // Step 5: Update customer.total_due
    const balanceChange = data.debit - data.credit;
    await customerRepo.updateBalance(data.customer_id, balanceChange);

    return {
      id: entryId,
      tenant_id: tenantId,
      customer_id: data.customer_id,
      entry_type: 'adjustment' as const,
      reference_id: entryId,
      debit: data.debit,
      credit: data.credit,
      running_balance: newBalance,
      notes: data.notes,
      created_by: userId,
      created_at: new Date().toISOString(),
    };
  });
}

/**
 * Generate a snapshot for a customer for a given date.
 * Aggregates all ledger entries on that day and stores the closing balance.
 */
export async function generateSnapshot(
  tenantId: string,
  customerId: string,
  date: string // YYYY-MM-DD
): Promise<void> {
  const customerRepo = new CustomerRepository(tenantId);
  const customer = await customerRepo.findById(customerId);
  if (!customer) throw new NotFoundError('Customer');

  // Get all entries for that date
  const { items, total } = await customerRepo.getLedgerPaged(customerId, 1, 10000, {
    from: date,
    to: date,
  });

  // Find closing balance (latest entry of the day, or previous day's balance)
  let closingBalance: number;
  if (items.length > 0) {
    closingBalance = Number(items[0].running_balance); // Already sorted desc
  } else {
    // No entries on this day — use current total_due as closing
    closingBalance = Number(customer.total_due);
  }

  const totalDebit = items.reduce((sum, e) => sum + Number(e.debit), 0);
  const totalCredit = items.reduce((sum, e) => sum + Number(e.credit), 0);

  await customerRepo.upsertSnapshot({
    id: uuidv4(),
    tenant_id: tenantId,
    customer_id: customerId,
    snapshot_date: date,
    closing_balance: closingBalance,
    total_debit: totalDebit,
    total_credit: totalCredit,
    entry_count: items.length,
  });
}
