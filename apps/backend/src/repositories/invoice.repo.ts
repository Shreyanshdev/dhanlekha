import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import db from '../config/database';
import { BranchScopedRepository } from './base.repo';
import type { Invoice, InvoiceItem, InvoiceSequence } from '@dhanlekha/shared';

export class InvoiceRepository extends BranchScopedRepository<Invoice> {
  constructor(tenantId: string, branchId: string, trx?: Knex.Transaction) {
    super(tenantId, branchId, 'invoices', trx);
  }

  // ─── Invoice Header Operations ────────────────────────────

  async findByNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    return await this.getQuery().where({ invoice_number: invoiceNumber }).first();
  }

  async listPaged(page: number, limit: number, filters: any = {}): Promise<{ items: Invoice[], total: number }> {
    const query = this.getQuery();

    if (filters.status) query.where({ status: filters.status });
    if (filters.customer_id) query.where({ customer_id: filters.customer_id });
    if (filters.start_date) query.where('created_at', '>=', filters.start_date);
    if (filters.end_date) query.where('created_at', '<=', filters.end_date);

    const [total, items] = await Promise.all([
      query.clone().count('id as count').first().then(r => Number(r?.count || 0)),
      query.clone().orderBy('created_at', 'desc').limit(limit).offset((page - 1) * limit)
    ]);

    return { items, total };
  }

  // ─── Invoice Item Operations (Consolidated) ────────────────

  async getItems(invoiceId: string): Promise<InvoiceItem[]> {
    return await (this.trx ? this.trx('invoice_items') : db('invoice_items'))
      .where({ tenant_id: this.tenantId, invoice_id: invoiceId });
  }

  async createItems(items: Partial<InvoiceItem>[]): Promise<void> {
    const data = items.map(item => ({
      ...item,
      tenant_id: this.tenantId
    }));
    await (this.trx ? this.trx('invoice_items') : db('invoice_items')).insert(data);
  }

  // ─── Sequence Operations (Consolidated) ────────────────────

  async getNextInvoiceNumber(): Promise<string> {
    const sequence = await (this.trx ? this.trx('invoice_sequences') : db('invoice_sequences'))
      .where({ tenant_id: this.tenantId, branch_id: this.branchId })
      .select('*')
      .forUpdate()
      .first();

    if (!sequence) {
      const id = uuidv4();
      await (this.trx ? this.trx('invoice_sequences') : db('invoice_sequences')).insert({
        id,
        tenant_id: this.tenantId,
        branch_id: this.branchId,
        prefix: 'INV',
        next_number: 2,
      });
      return 'INV-0001';
    }

    const currentNumber = sequence.next_number;
    const formattedNumber = `${sequence.prefix}-${currentNumber.toString().padStart(4, '0')}`;

    await (this.trx ? this.trx('invoice_sequences') : db('invoice_sequences'))
      .where({ id: sequence.id })
      .update({
        next_number: currentNumber + 1,
        updated_at: new Date().toISOString(),
      });

    return formattedNumber;
  }
}
