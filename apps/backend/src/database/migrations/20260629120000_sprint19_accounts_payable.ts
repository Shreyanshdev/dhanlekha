import type { Knex } from 'knex';

/**
 * Sprint 19 — Accounts Payable & Supplier Payments
 *
 * Mirrors the customer receivable side:
 *   - supplier_ledger              — debit/credit/running_balance per supplier
 *   - supplier_payments            — money paid out to suppliers
 *   - supplier_payment_allocations — link payments to purchases
 *   - suppliers.total_payable      — cached outstanding payable (paise)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('suppliers', (table) => {
    table
      .integer('total_payable')
      .notNullable()
      .defaultTo(0)
      .comment('Cached outstanding payable in paise');
  });

  await knex.schema.createTable('supplier_ledger', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('supplier_id').notNullable().references('id').inTable('suppliers').onDelete('CASCADE');

    table.string('entry_type').notNullable().comment('purchase | payment | adjustment');
    table.uuid('reference_id').notNullable();

    table.integer('debit').notNullable().defaultTo(0).comment('Increases payable, in paise');
    table.integer('credit').notNullable().defaultTo(0).comment('Reduces payable, in paise');
    table.integer('running_balance').notNullable().comment('Outstanding payable after this entry, in paise');

    table.text('notes').nullable();
    table.uuid('created_by').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'supplier_id'], 'idx_supplier_ledger_tenant_supplier');
    table.index(['supplier_id', 'created_at'], 'idx_supplier_ledger_supplier');
    table.index(['reference_id'], 'idx_supplier_ledger_reference');
  });

  await knex.schema.createTable('supplier_payments', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants');
    table.uuid('branch_id').notNullable().references('id').inTable('branches');
    table.uuid('supplier_id').notNullable().references('id').inTable('suppliers');
    table.uuid('created_by').notNullable();

    table.integer('amount').notNullable().comment('Total paid out in paise');
    table
      .integer('unallocated_amount')
      .notNullable()
      .defaultTo(0)
      .comment('Remaining unallocated portion in paise');
    table
      .enum('payment_mode', ['cash', 'upi', 'card', 'bank_transfer', 'cheque'])
      .notNullable()
      .defaultTo('cash');
    table
      .enum('status', ['received', 'fully_allocated', 'partially_allocated'])
      .notNullable()
      .defaultTo('received');

    table.string('reference_number', 100).nullable();
    table.text('note').nullable();
    table.string('payment_date', 10).notNullable().comment('YYYY-MM-DD local date');

    table.boolean('is_deleted').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'branch_id', 'is_deleted'], 'idx_supplier_payments_tenant_branch');
    table.index(['supplier_id', 'is_deleted'], 'idx_supplier_payments_supplier');
    table.index(['payment_date'], 'idx_supplier_payments_date');
  });

  await knex.schema.createTable('supplier_payment_allocations', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants');
    table
      .uuid('supplier_payment_id')
      .notNullable()
      .references('id')
      .inTable('supplier_payments');
    table.uuid('purchase_id').notNullable().references('id').inTable('purchases');
    table.integer('allocated_amount').notNullable().comment('Amount applied to this purchase, in paise');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['supplier_payment_id', 'purchase_id'], {
      indexName: 'uq_supplier_payment_purchase_allocation',
    });
    table.index(['supplier_payment_id'], 'idx_supplier_alloc_payment');
    table.index(['purchase_id'], 'idx_supplier_alloc_purchase');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('supplier_payment_allocations');
  await knex.schema.dropTableIfExists('supplier_payments');
  await knex.schema.dropTableIfExists('supplier_ledger');
  await knex.schema.alterTable('suppliers', (table) => {
    table.dropColumn('total_payable');
  });
}
