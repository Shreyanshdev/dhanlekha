import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── INVOICES ──
  await knex.schema.createTable('invoices', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE').notNullable();
    table.uuid('branch_id').references('id').inTable('branches').onDelete('CASCADE').notNullable();
    table.uuid('customer_id').references('id').inTable('customers').onDelete('SET NULL').nullable();
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL').nullable();
    
    table.string('invoice_number').notNullable();
    table.decimal('subtotal', 15, 2).notNullable();
    table.decimal('tax_amount', 15, 2).notNullable();
    table.decimal('discount_amount', 15, 2).defaultTo(0);
    table.decimal('final_amount', 15, 2).notNullable();
    table.decimal('amount_paid', 15, 2).defaultTo(0);
    table.decimal('amount_due', 15, 2).notNullable();
    
    table.string('status').notNullable().defaultTo('unpaid'); // paid, partial, unpaid, cancelled
    table.text('note').nullable();
    
    table.boolean('is_deleted').defaultTo(false);
    table.timestamps(true, true);

    // Indices for performance
    table.index(['tenant_id', 'branch_id']);
    table.index(['customer_id']);
    table.index(['invoice_number']);
    table.unique(['tenant_id', 'invoice_number']); // Invoice numbers unique per tenant
  });

  // ── INVOICE ITEMS ──
  await knex.schema.createTable('invoice_items', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE').notNullable();
    table.uuid('invoice_id').references('id').inTable('invoices').onDelete('CASCADE').notNullable();
    table.uuid('product_id').references('id').inTable('products').onDelete('SET NULL').nullable();
    
    table.decimal('quantity', 15, 3).notNullable();
    table.decimal('unit_price', 15, 2).notNullable();
    table.decimal('gst_rate', 5, 2).notNullable();
    table.decimal('discount_amount', 15, 2).defaultTo(0);
    table.decimal('total', 15, 2).notNullable();
    
    table.index(['invoice_id']);
    table.index(['product_id']);
  });

  // ── CUSTOMER LEDGER ──
  await knex.schema.createTable('customer_ledger', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE').notNullable();
    table.uuid('customer_id').references('id').inTable('customers').onDelete('CASCADE').notNullable();
    
    table.string('entry_type').notNullable(); // invoice, payment, adjustment
    table.uuid('reference_id').notNullable(); // invoice_id or payment_id
    
    table.decimal('debit', 15, 2).defaultTo(0);
    table.decimal('credit', 15, 2).defaultTo(0);
    table.decimal('running_balance', 15, 2).notNullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['tenant_id', 'customer_id']);
    table.index(['reference_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('customer_ledger');
  await knex.schema.dropTableIfExists('invoice_items');
  await knex.schema.dropTableIfExists('invoices');
}
