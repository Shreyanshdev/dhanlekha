import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── payments ──────────────────────────────────────────────────────────
  // Records money received from a customer. Decoupled from invoices.
  // Payment amount can exceed allocated amount (advance payment).
  await knex.schema.createTable('payments', (table) => {
    table.string('id', 36).primary();
    table.string('tenant_id', 36).notNullable().references('id').inTable('tenants');
    table.string('branch_id', 36).notNullable().references('id').inTable('branches');
    table.string('customer_id', 36).nullable().references('id').inTable('customers');
    table.string('created_by', 36).notNullable();

    // Payment details
    table.integer('amount').notNullable().comment('Total received in paise');
    table.integer('unallocated_amount').notNullable().defaultTo(0).comment('Remaining unallocated portion in paise');
    table.enum('payment_mode', ['cash', 'upi', 'card', 'bank_transfer', 'cheque']).notNullable().defaultTo('cash');
    table.enum('status', ['received', 'fully_allocated', 'partially_allocated']).notNullable().defaultTo('received');

    table.string('reference_number', 100).nullable().comment('UPI txn ID / cheque number / bank ref');
    table.text('note').nullable();
    table.string('payment_date', 10).notNullable().comment('YYYY-MM-DD local date');

    table.boolean('is_deleted').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index(['tenant_id', 'branch_id', 'is_deleted'], 'idx_payments_tenant_branch');
    table.index(['customer_id', 'is_deleted'], 'idx_payments_customer');
    table.index(['payment_date'], 'idx_payments_date');
  });

  // ── payment_allocations ───────────────────────────────────────────────
  // Bridge table (M:N) — one payment can settle many invoices.
  // Each row links one payment to one invoice for a specific allocated amount.
  await knex.schema.createTable('payment_allocations', (table) => {
    table.string('id', 36).primary();
    table.string('tenant_id', 36).notNullable().references('id').inTable('tenants');
    table.string('payment_id', 36).notNullable().references('id').inTable('payments');
    table.string('invoice_id', 36).notNullable().references('id').inTable('invoices');
    table.integer('allocated_amount').notNullable().comment('Amount from this payment applied to this invoice, in paise');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // A payment can only be allocated to a specific invoice once
    table.unique(['payment_id', 'invoice_id'], { indexName: 'uq_payment_invoice_allocation' });
    table.index(['payment_id'], 'idx_allocations_payment');
    table.index(['invoice_id'], 'idx_allocations_invoice');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payment_allocations');
  await knex.schema.dropTableIfExists('payments');
}
