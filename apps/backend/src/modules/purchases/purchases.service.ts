import { v4 as uuidv4 } from 'uuid';
import { PurchaseRepository } from '../../repositories/purchase.repo';
import { InventoryRepository, InventoryLogRepository } from '../../repositories/inventory.repo';
import { withTransaction } from '../../database/transaction';
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
    const invRepo = new InventoryRepository(tenantId, data.branch_id, trx);
    const logRepo = new InventoryLogRepository(tenantId, data.branch_id, trx);

    const purchaseId = uuidv4();
    const purchaseNumber = `PUR-${Date.now()}`; // Simple sequence for now
    
    // Status Logic: If total_amount == paid_amount, payment_status is paid
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
      purchase_price: item.purchase_price, // Updated name
      tax_rate: item.tax_rate,
      tax_amount: item.tax_amount,
      total: item.total,                   // Updated name
      batch_number: item.batch_number ?? null,
      expiry_date: item.expiry_date ?? null,
    }));

    // Step 1: Save Purchase & Items
    await purchaseRepo.create(purchase);
    await purchaseRepo.addItems(purchaseItems);

    // Step 2 & 3: Process each item (Inventory Update + Logs)
    for (const item of purchaseItems) {
      const inventory = await invRepo.findById(item.product_id);
      
      if (inventory) {
        // Increment existing stock & Update cost price to latest
        await invRepo.update(item.product_id, {
          total_quantity: Number(inventory.total_quantity) + Number(item.quantity),
          purchase_price: item.purchase_price, // Update latest cost
        });
      } else {
        // Initialize inventory for this branch if it doesn't exist
        await invRepo.getQuery().insert({
          id: uuidv4(),
          tenant_id: tenantId,
          branch_id: data.branch_id,
          product_id: item.product_id,
          total_quantity: item.quantity,
          purchase_price: item.purchase_price,
          selling_price: item.purchase_price * 1.2, // Default 20% markup if unknown
          min_stock_alert: 5,
        });
      }

      // Log movement
      const log: Partial<InventoryLog> = {
        id: uuidv4(),
        tenant_id: tenantId,
        branch_id: data.branch_id,
        product_id: item.product_id,
        change_type: 'purchase',
        quantity_change: item.quantity,
        reference_id: purchaseId,
        notes: `Purchase ${purchaseNumber}`,
        created_by: userId,
      };
      await logRepo.create(log as InventoryLog);
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
