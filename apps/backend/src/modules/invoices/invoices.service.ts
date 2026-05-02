import { v4 as uuidv4 } from 'uuid';
import { InvoiceRepository } from '../../repositories/invoice.repo';
import { InventoryRepository, InventoryLogRepository } from '../../repositories/inventory.repo';
import { CustomerRepository } from '../../repositories/customer.repo';
import { withTransaction } from '../../database/transaction';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import type { CreateInvoiceInput } from './invoices.validator';
import type { Invoice, InvoiceItem } from '@dhanlekha/shared';

/**
 * Atomic Invoice Creation Flow
 * Ensures financial correctness, inventory synchronization, and ledger accuracy.
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

    // 2. Recalculate Totals (Never trust frontend)
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    const itemsToCreate: Partial<InvoiceItem>[] = [];

    for (const item of data.items) {
      // Calculate item values
      const itemSubtotal = item.unit_price * item.quantity;
      const itemTaxableAmount = itemSubtotal - item.discount_amount;
      const itemTax = (itemTaxableAmount * item.gst_rate) / 100;
      const itemTotal = itemTaxableAmount + itemTax;

      subtotal += itemSubtotal;
      totalTax += itemTax;
      totalDiscount += item.discount_amount;

      itemsToCreate.push({
        id: uuidv4(),
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        gst_rate: item.gst_rate,
        discount_amount: item.discount_amount,
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
      const currentBalance = latestEntry ? Number(latestEntry.running_balance) : Number(customer.total_due);
      const newBalance = currentBalance + finalAmount; 
      
      await customerRepo.addLedgerEntry({
        id: uuidv4(),
        tenant_id: tenantId,
        customer_id: data.customer_id,
        entry_type: 'invoice',
        reference_id: invoiceId,
        debit: finalAmount,
        credit: 0,
        running_balance: newBalance,
      });

      // Sync the denormalized total_due on customer
      await customerRepo.updateBalance(data.customer_id, finalAmount);
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

    const invoice = await invoiceRepo.findById(invoiceId);
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
      const newBalance = currentBalance - Number(invoice.final_amount);

      await customerRepo.addLedgerEntry({
        id: uuidv4(),
        tenant_id: tenantId,
        customer_id: invoice.customer_id,
        entry_type: 'adjustment',
        reference_id: invoiceId,
        debit: 0,
        credit: invoice.final_amount,
        running_balance: newBalance,
      });

      await customerRepo.updateBalance(invoice.customer_id, -Number(invoice.final_amount));
    }
  });
}
