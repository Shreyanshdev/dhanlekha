import { v4 as uuidv4 } from 'uuid';
import { PurchaseRepository } from '../../repositories/purchase.repo';
import { SupplierRepository } from '../../repositories/supplier.repo';
import { InventoryRepository, InventoryLogRepository, InventoryBatchRepository } from '../../repositories/inventory.repo';
import { withTransaction } from '../../database/transaction';
import { postJournal } from '../../accounting/ledger.service';
import { ACCOUNTS } from '../../accounting/coa';
import { NotFoundError } from '../../utils/errors';
import type { Purchase, PurchaseItem, InventoryLog } from '@dhanlekha/shared';
import type { CreatePurchaseInput } from './purchases.validator';

/**
 * Record a new stock-in purchase.
 * Atomic Workflow:
 * 1. Save Purchase + Purchase Items
 * 2. Update Inventory (increment stock + update cost price)
 * 3. Log inventory movement
 */
export async function createPurchase(
  tenantId: string,
  userId: string,
  data: CreatePurchaseInput
): Promise<Purchase> {
  return await withTransaction(async (trx) => {
    const purchaseRepo = new PurchaseRepository(tenantId, trx);
    const supplierRepo = new SupplierRepository(tenantId, trx);
    const invRepo = new InventoryRepository(tenantId, data.branch_id, trx);
    const batchRepo = new InventoryBatchRepository(tenantId, data.branch_id, trx);
    const logRepo = new InventoryLogRepository(tenantId, data.branch_id, trx);

    const purchaseId = uuidv4();
    const purchaseNumber = `PUR-${Date.now()}`; 
    
    // Status Logic
    const paymentStatus = data.paid_amount >= data.total_amount 
      ? 'paid' 
      : data.paid_amount > 0 ? 'partial' : 'unpaid';

    const purchase: Purchase = {
      id: purchaseId,
      tenant_id: tenantId,
      branch_id: data.branch_id,
      supplier_id: data.supplier_id,
      purchase_number: purchaseNumber,
      supplier_invoice_number: data.supplier_invoice_number ?? null,
      subtotal: data.subtotal,
      tax_amount: data.tax_amount,
      discount_amount: data.discount_amount,
      total_amount: data.total_amount,
      paid_amount: data.paid_amount,
      status: 'received',
      payment_status: paymentStatus,
      notes: data.notes ?? null,
      purchase_date: data.purchase_date ?? new Date().toISOString().split('T')[0],
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
    };

    const purchaseItems: PurchaseItem[] = data.items.map(item => ({
      id: uuidv4(),
      tenant_id: tenantId,
      purchase_id: purchaseId,
      product_id: item.product_id,
      quantity: item.quantity,
      purchase_price: item.purchase_price,
      tax_rate: item.tax_rate,
      tax_amount: item.tax_amount,
      total: item.total,
      batch_number: item.batch_number ?? null,
      expiry_date: item.expiry_date ?? null,
    }));

    // Step 1: Save Purchase & Items
    await purchaseRepo.create(purchase);
    await purchaseRepo.addItems(purchaseItems);

    // Step 2, 3 & 4: Process each item
    for (const item of purchaseItems) {
      // 2. Update Master Inventory
      const inventory = await invRepo.findById(item.product_id);
      
      if (inventory) {
        await invRepo.update(item.product_id, {
          total_quantity: Number(inventory.total_quantity) + Number(item.quantity),
          purchase_price: item.purchase_price,
        });
      } else {
        await invRepo.getQuery().insert({
          id: uuidv4(),
          tenant_id: tenantId,
          branch_id: data.branch_id,
          product_id: item.product_id,
          total_quantity: item.quantity,
          purchase_price: item.purchase_price,
          selling_price: item.purchase_price * 1.2,
          min_stock_alert: 5,
        });
      }

      // 3. Update/Create Batch (if tracking enabled)
      let batchId: string | null = null;
      if (item.batch_number) {
        const existingBatch = await batchRepo.findByBatchNumber(item.product_id, item.batch_number);
        if (existingBatch) {
          batchId = existingBatch.id;
          await batchRepo.update(batchId, {
            quantity: Number(existingBatch.quantity) + Number(item.quantity),
            purchase_price: item.purchase_price, // Update to latest batch cost
          });
        } else {
          batchId = uuidv4();
          await batchRepo.getQuery().insert({
            id: batchId,
            tenant_id: tenantId,
            branch_id: data.branch_id,
            product_id: item.product_id,
            batch_number: item.batch_number,
            quantity: item.quantity,
            purchase_price: item.purchase_price,
            selling_price: item.purchase_price * 1.2,
            exp_date: item.expiry_date ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      // 4. Log movement
      const log: Partial<InventoryLog> = {
        id: uuidv4(),
        tenant_id: tenantId,
        branch_id: data.branch_id,
        product_id: item.product_id,
        batch_id: batchId, // Link to batch if applicable
        change_type: 'purchase',
        quantity_change: item.quantity,
        reference_id: purchaseId,
        notes: `Purchase ${purchaseNumber}`,
        created_by: userId,
      };
      await logRepo.create(log as InventoryLog);
    }

    // Post the GL entry for this purchase (Sprint 18):
    //   Dr Purchases (net of tax) + Dr GST Input Credit
    //   Cr Accounts Payable (unpaid) + Cr Cash (paid)
    if (data.total_amount > 0) {
      const goodsValue = data.total_amount - data.tax_amount;
      const payablePortion = data.total_amount - data.paid_amount;
      const lines = [
        { account_code: ACCOUNTS.PURCHASES, debit: goodsValue },
        { account_code: ACCOUNTS.GST_INPUT_CREDIT, debit: data.tax_amount },
        { account_code: ACCOUNTS.ACCOUNTS_PAYABLE, credit: payablePortion },
        { account_code: ACCOUNTS.CASH, credit: data.paid_amount },
      ].filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0);

      await postJournal(trx, {
        tenantId,
        branchId: data.branch_id,
        entryDate: purchase.purchase_date,
        narration: `Purchase ${purchaseNumber}`,
        referenceType: 'purchase',
        referenceId: purchaseId,
        createdBy: userId,
        lines,
      });
    }

    // Supplier payable ledger (Sprint 19) — mirror customer invoice ledger pattern.
    const supplier = await supplierRepo.findById(data.supplier_id);
    if (!supplier) throw new NotFoundError('Supplier');

    const payablePortion = data.total_amount - data.paid_amount;
    const latestEntry = await supplierRepo.getLatestLedgerEntry(data.supplier_id);
    const startBalance = latestEntry
      ? Number(latestEntry.running_balance)
      : Number(supplier.total_payable ?? 0);

    const balanceAfterPurchase = startBalance + data.total_amount;
    await supplierRepo.addLedgerEntry({
      id: uuidv4(),
      tenant_id: tenantId,
      supplier_id: data.supplier_id,
      entry_type: 'purchase',
      reference_id: purchaseId,
      debit: data.total_amount,
      credit: 0,
      running_balance: balanceAfterPurchase,
      created_by: userId,
    });

    let finalBalance = balanceAfterPurchase;
    if (data.paid_amount > 0) {
      finalBalance = balanceAfterPurchase - data.paid_amount;
      await supplierRepo.addLedgerEntry({
        id: uuidv4(),
        tenant_id: tenantId,
        supplier_id: data.supplier_id,
        entry_type: 'payment',
        reference_id: purchaseId,
        debit: 0,
        credit: data.paid_amount,
        running_balance: finalBalance,
        created_by: userId,
      });
    }

    if (payablePortion !== 0) {
      await supplierRepo.updatePayable(data.supplier_id, payablePortion);
    }

    return purchase;
  });
}

export async function getPurchaseDetail(tenantId: string, id: string) {
  const purchaseRepo = new PurchaseRepository(tenantId);
  const purchase = await purchaseRepo.findById(id);
  if (!purchase) throw new NotFoundError('Purchase');

  const items = await purchaseRepo.getItems(id);
  return { ...purchase, items };
}

export async function listPurchases(tenantId: string, page: number, limit: number, filters: any) {
  const purchaseRepo = new PurchaseRepository(tenantId);
  return await purchaseRepo.listPaged(page, limit, filters);
}
