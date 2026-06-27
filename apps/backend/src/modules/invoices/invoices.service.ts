import { v4 as uuidv4 } from 'uuid';
import { InvoiceRepository } from '../../repositories/invoice.repo';
import { ProductRepository } from '../../repositories/product.repo';
import { InventoryRepository, InventoryLogRepository } from '../../repositories/inventory.repo';
import { CustomerRepository } from '../../repositories/customer.repo';
import { OfferRepository } from '../../repositories/offer.repo';
import { UsageRepository } from '../../repositories/usage.repo';
import { findBestOfferForItem } from '../offers/offers.service';
import { withTransaction } from '../../database/transaction';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { lineAmount, percentageOf, roundPaise } from '../../utils/money';
import { postJournal } from '../../accounting/ledger.service';
import { ACCOUNTS } from '../../accounting/coa';
import type { CreateInvoiceInput } from './invoices.validator';
import type { Invoice, InvoiceItem, Product, Inventory } from '@dhanlekha/shared';

/** Feature flag key used to meter monthly invoice quota. */
const INVOICE_QUOTA_FEATURE = 'max_invoices_per_month';

/**
 * Atomic Invoice Creation Flow (Sprint 5 + Sprint 6)
 *
 * Supports TWO billing modes:
 *   1. Barcode Scan — frontend sends { product_id, quantity } only → backend auto-fetches price/tax
 *   2. Manual Entry — frontend sends { product_id, quantity, unit_price, gst_rate } → backend uses provided values
 */
export async function createInvoice(
  tenantId: string,
  branchId: string,
  userId: string,
  data: CreateInvoiceInput
): Promise<Invoice> {
  return await withTransaction(async (trx) => {
    // 1. Initialize Repositories with Transaction
    const invoiceRepo = new InvoiceRepository(tenantId, branchId, trx);
    const inventoryRepo = new InventoryRepository(tenantId, branchId, trx);
    const logRepo = new InventoryLogRepository(tenantId, branchId, trx);
    const customerRepo = new CustomerRepository(tenantId, trx);

    // 2. Batch-fetch Product & Inventory data (Sprint 6 optimization)
    //    Single query per table instead of N+1 per item
    const productIds = data.items.map(i => i.product_id);
    const productRepo = new ProductRepository(tenantId, trx);

    const [products, inventories] = await Promise.all([
      productRepo.getQuery().whereIn('id', productIds) as Promise<Product[]>,
      inventoryRepo.getQuery().whereIn('product_id', productIds) as Promise<Inventory[]>,
    ]);

    const productMap = new Map<string, Product>(products.map(p => [p.id, p]));
    const inventoryMap = new Map<string, Inventory>(inventories.map(i => [i.product_id, i]));

    // 3a. Resolve each line (price, tax, stock) and compute the gross subtotal
    //     first — needed so invoice-level / min-purchase offers see the full cart.
    const resolved = data.items.map(item => {
      const product = productMap.get(item.product_id);
      const inventory = inventoryMap.get(item.product_id);

      if (!product) {
        throw new NotFoundError(`Product ${item.product_id}`);
      }
      if (!inventory) {
        throw new BadRequestError(`Product '${product.name}' has no inventory in this branch`);
      }

      // Sprint 6: Use frontend values if provided, otherwise auto-fetch from DB
      const unitPrice = item.unit_price ?? Number(inventory.selling_price);
      const gstRate = item.gst_rate ?? Number(product.gst_rate);

      // Validate stock availability
      if (Number(inventory.total_quantity) < item.quantity) {
        throw new BadRequestError(
          `Insufficient stock for '${product.name}'. Available: ${inventory.total_quantity}, Requested: ${item.quantity}`
        );
      }

      // All money is integer paise — round the line subtotal to whole paise.
      return { item, product, unitPrice, gstRate, itemSubtotal: lineAmount(unitPrice, item.quantity) };
    });

    const grossSubtotal = resolved.reduce((sum, r) => sum + r.itemSubtotal, 0);

    // 3b. Recalculate totals, auto-applying the best offer per line (Sprint 10/17).
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    const itemsToCreate: Partial<InvoiceItem>[] = [];
    const offerUsage = new Map<string, number>(); // offer_id → times applied

    for (const r of resolved) {
      const manualDiscount = r.item.discount_amount;

      // Auto-apply the best active offer only when it beats the manual discount.
      const best = await findBestOfferForItem(
        tenantId,
        branchId,
        r.item.product_id,
        r.product.category ?? null,
        r.unitPrice,
        r.item.quantity,
        grossSubtotal,
        trx
      );

      let effectiveDiscount = manualDiscount;
      let offerId: string | null = null;
      if (best && best.discountAmount > manualDiscount) {
        effectiveDiscount = best.discountAmount;
        offerId = best.offer.id;
        offerUsage.set(offerId, (offerUsage.get(offerId) ?? 0) + 1);
      }

      // Never let a discount exceed the line subtotal (whole paise).
      effectiveDiscount = Math.min(roundPaise(effectiveDiscount), r.itemSubtotal);

      const itemTaxableAmount = r.itemSubtotal - effectiveDiscount;
      const itemTax = percentageOf(itemTaxableAmount, r.gstRate);
      const itemTotal = itemTaxableAmount + itemTax;

      subtotal += r.itemSubtotal;
      totalTax += itemTax;
      totalDiscount += effectiveDiscount;

      itemsToCreate.push({
        id: uuidv4(),
        product_id: r.item.product_id,
        quantity: r.item.quantity,
        unit_price: r.unitPrice,
        gst_rate: r.gstRate,
        discount_amount: effectiveDiscount,
        offer_id: offerId,
        total: itemTotal,
      });
    }

    const finalAmount = subtotal - totalDiscount + totalTax;
    const amountDue = finalAmount - data.amount_paid;

    // 3. Generate Invoice Number (Atomic Lock)
    const invoiceNumber = await invoiceRepo.getNextInvoiceNumber();

    // 4. Create Invoice Header
    const invoiceId = uuidv4();
    const invoiceData: Partial<Invoice> = {
      id: invoiceId,
      tenant_id: tenantId,
      branch_id: branchId,
      customer_id: data.customer_id || null,
      created_by: userId,
      invoice_number: invoiceNumber,
      subtotal,
      tax_amount: totalTax,
      discount_amount: totalDiscount,
      final_amount: finalAmount,
      amount_paid: data.amount_paid,
      amount_due: amountDue,
      status: amountDue <= 0 ? 'paid' : (data.amount_paid > 0 ? 'partial' : 'unpaid'),
      note: data.note || null,
      is_deleted: false,
    };
    await invoiceRepo.create(invoiceData);

    // 5. Create Invoice Items
    const itemsWithInvoiceId = itemsToCreate.map(item => ({
      ...item,
      invoice_id: invoiceId,
    }));
    await invoiceRepo.createItems(itemsWithInvoiceId);

    // 5a. Increment used_count for every offer applied on this invoice.
    if (offerUsage.size > 0) {
      const offerRepo = new OfferRepository(tenantId, trx);
      for (const [offerId, times] of offerUsage) {
        await offerRepo.incrementUsedCount(offerId, times);
      }
    }

    // 5b. Meter monthly invoice usage for SaaS plan quota enforcement.
    await new UsageRepository(tenantId, trx).increment(INVOICE_QUOTA_FEATURE);

    // 5c. Post the double-entry journal for this sale (Sprint 18 GL):
    //   Dr Cash (paid) + Dr Accounts Receivable (due) + Dr Discounts Allowed
    //   Cr Sales (subtotal) + Cr GST Output Payable (tax)
    if (subtotal > 0) {
      const cashPortion = Math.min(Math.max(data.amount_paid, 0), finalAmount);
      const arPortion = finalAmount - cashPortion;
      const lines = [
        { account_code: ACCOUNTS.CASH, debit: cashPortion },
        { account_code: ACCOUNTS.ACCOUNTS_RECEIVABLE, debit: arPortion },
        { account_code: ACCOUNTS.DISCOUNTS_ALLOWED, debit: totalDiscount },
        { account_code: ACCOUNTS.SALES, credit: subtotal },
        { account_code: ACCOUNTS.GST_OUTPUT_PAYABLE, credit: totalTax },
      ].filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0);

      await postJournal(trx, {
        tenantId,
        branchId,
        narration: `Invoice ${invoiceNumber}`,
        referenceType: 'invoice',
        referenceId: invoiceId,
        createdBy: userId,
        lines,
      });
    }

    // 6. Update Inventory & Log Movements
    for (const item of data.items) {
      // Decrement inventory
      await inventoryRepo.decrementStock(item.product_id, item.quantity);

      // Add audit log
      await logRepo.create({
        id: uuidv4(),
        product_id: item.product_id,
        change_type: 'sale',
        quantity_change: -item.quantity,
        reference_id: invoiceId,
        notes: `Sale - ${invoiceNumber}`,
        created_by: userId,
      });
    }

    // 7. Handle Customer Ledger & Udhaar (if not anonymous)
    if (data.customer_id) {
      const customer = await customerRepo.findById(data.customer_id);
      if (!customer) throw new NotFoundError('Customer');

      // Strict Credit Limit Check
      if (amountDue > 0) {
        const potentialTotalDue = Number(customer.total_due) + amountDue;
        if (potentialTotalDue > Number(customer.credit_limit)) {
          throw new BadRequestError(`Credit limit exceeded. Available credit: ${Number(customer.credit_limit) - Number(customer.total_due)}`);
        }
      }

      // Get latest ledger entry to calculate running balance
      const latestEntry = await customerRepo.getLatestLedgerEntry(data.customer_id);
      const startBalance = latestEntry ? Number(latestEntry.running_balance) : Number(customer.total_due);

      // A. Record Invoice Debit (full amount owed)
      const balanceAfterInvoice = startBalance + finalAmount;
      await customerRepo.addLedgerEntry({
        id: uuidv4(),
        tenant_id: tenantId,
        customer_id: data.customer_id,
        entry_type: 'invoice',
        reference_id: invoiceId,
        debit: finalAmount,
        credit: 0,
        running_balance: balanceAfterInvoice,
      });

      // B. Record Payment Credit (if any payment made at time of billing)
      let finalBalance = balanceAfterInvoice;
      if (data.amount_paid > 0) {
        finalBalance = balanceAfterInvoice - data.amount_paid;
        await customerRepo.addLedgerEntry({
          id: uuidv4(),
          tenant_id: tenantId,
          customer_id: data.customer_id,
          entry_type: 'payment',
          reference_id: invoiceId,
          debit: 0,
          credit: data.amount_paid,
          running_balance: finalBalance,
        });
      }

      // Sync denormalized total_due (only the unpaid portion)
      await customerRepo.updateBalance(data.customer_id, amountDue);
    }

    return (await invoiceRepo.findById(invoiceId)) as Invoice;
  });
}

/**
 * List invoices with pagination
 */
export async function listInvoices(
  tenantId: string,
  branchId: string,
  query: any
): Promise<{ items: Invoice[], total: number }> {
  const repo = new InvoiceRepository(tenantId, branchId);
  return await repo.listPaged(
    Number(query.page || 1),
    Number(query.limit || 20),
    query
  );
}

/**
 * Get full invoice details with line items
 */
export async function getInvoiceDetails(
  tenantId: string,
  branchId: string,
  invoiceId: string
): Promise<Invoice & { items: InvoiceItem[] }> {
  const invoiceRepo = new InvoiceRepository(tenantId, branchId);

  const invoice = await invoiceRepo.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  const items = await invoiceRepo.getItems(invoiceId);

  return {
    ...invoice,
    items,
  };
}

/**
 * Cancel an invoice (Soft delete + Reverse inventory)
 */
export async function cancelInvoice(
  tenantId: string,
  branchId: string,
  userId: string,
  invoiceId: string
): Promise<void> {
  return await withTransaction(async (trx) => {
    const invoiceRepo = new InvoiceRepository(tenantId, branchId, trx);
    const inventoryRepo = new InventoryRepository(tenantId, branchId, trx);
    const logRepo = new InventoryLogRepository(tenantId, branchId, trx);
    const customerRepo = new CustomerRepository(tenantId, trx);

    const invoice = await invoiceRepo.findIncludingDeleted(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice');
    if (invoice.status === 'cancelled') throw new BadRequestError('Invoice is already cancelled');

    // 1. Soft delete invoice
    await invoiceRepo.update(invoiceId, { status: 'cancelled', is_deleted: true });

    // 2. Reverse Inventory
    const items = await invoiceRepo.getItems(invoiceId);
    for (const item of items) {
      if (item.product_id) {
        await inventoryRepo.incrementStock(item.product_id, item.quantity);
        await logRepo.create({
          id: uuidv4(),
          product_id: item.product_id,
          change_type: 'adjustment',
          quantity_change: item.quantity,
          reference_id: invoiceId,
          notes: `Restock - Cancelled Invoice ${invoice.invoice_number}`,
          created_by: userId,
        });
      }
    }

    // 3. Reverse Ledger if applicable
    if (invoice.customer_id) {
      const latestEntry = await customerRepo.getLatestLedgerEntry(invoice.customer_id);
      const currentBalance = latestEntry ? Number(latestEntry.running_balance) : 0;
      const reversalAmount = Number(invoice.amount_due); // Only reverse the unpaid portion
      const newBalance = currentBalance - reversalAmount;

      await customerRepo.addLedgerEntry({
        id: uuidv4(),
        tenant_id: tenantId,
        customer_id: invoice.customer_id,
        entry_type: 'adjustment',
        reference_id: invoiceId,
        debit: 0,
        credit: reversalAmount,
        running_balance: newBalance,
      });

      // Reverse only the amount_due (what was actually owed)
      await customerRepo.updateBalance(invoice.customer_id, -reversalAmount);
    }
  });
}
