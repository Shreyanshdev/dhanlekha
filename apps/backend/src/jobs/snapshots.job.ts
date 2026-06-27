import { TenantRepository } from '../repositories/tenant.repo';
import { CustomerRepository } from '../repositories/customer.repo';
import { generateSnapshot } from '../modules/ledger/ledger.service';

/**
 * Daily ledger-snapshot job.
 *
 * Walks every tenant's customers and materialises a closing-balance snapshot for
 * the target day (defaults to yesterday). Snapshots make customer-statement and
 * ageing reports fast by avoiding full ledger replays. Per-customer failures are
 * logged and skipped so one bad row never aborts the whole run.
 */
export async function generateLedgerSnapshots(targetDate?: string): Promise<void> {
  const date = targetDate || new Date(Date.now() - 86400000).toISOString().split('T')[0]; // yesterday
  console.log(`[Jobs] Generating ledger snapshots for ${date}...`);

  const tenantRepo = new TenantRepository();
  const tenants = await tenantRepo.findAll();

  let count = 0;
  for (const tenant of tenants) {
    const customerRepo = new CustomerRepository(tenant.id);
    const customers = await customerRepo.findAll();

    for (const customer of customers) {
      try {
        await generateSnapshot(tenant.id, customer.id, date);
        count++;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[Jobs] Snapshot failed for customer ${customer.id}: ${msg}`);
      }
    }
  }

  console.log(`[Jobs] Ledger snapshots finished for ${date} (${count} customers).`);
}
