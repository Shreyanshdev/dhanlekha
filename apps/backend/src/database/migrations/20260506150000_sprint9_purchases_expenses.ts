import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ─── Purchases Table ───────────────────────────────────────
  await knex.schema.createTable('purchases', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().index();
    table.uuid('branch_id').notNullable().index();
    table.uuid('supplier_id').notNullable().index();
    
    table.string('purchase_number').notNullable().index();
    table.string('supplier_invoice_number').nullable();
    
    table.decimal('subtotal', 15, 2).notNullable().defaultTo(0);
    table.decimal('tax_amount', 15, 2).notNullable().defaultTo(0);
    table.decimal('discount_amount', 15, 2).notNullable().defaultTo(0);
    table.decimal('total_amount', 15, 2).notNullable().defaultTo(0); // Matches spec name total_amount
    table.decimal('paid_amount', 15, 2).notNullable().defaultTo(0);
    
    table.enum('status', ['pending', 'received', 'cancelled']).defaultTo('received');
    table.enum('payment_status', ['unpaid', 'partial', 'paid']).defaultTo('unpaid');
    
    table.text('notes').nullable();
    table.date('purchase_date').notNullable().defaultTo(knex.fn.now());
    
    table.uuid('created_by').notNullable();
    table.timestamps(true, true);
    table.boolean('is_deleted').defaultTo(false); // Changed from deleted_at to match project convention
    
    table.foreign('tenant_id').references('id').inTable('tenants');
    table.foreign('branch_id').references('id').inTable('branches');
    table.foreign('supplier_id').references('id').inTable('suppliers');
    
    table.index(['tenant_id', 'is_deleted']);
  });

  // ─── Purchase Items Table ──────────────────────────────────
  await knex.schema.createTable('purchase_items', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.uuid('purchase_id').notNullable().index();
    table.uuid('product_id').notNullable().index();
    
    table.decimal('quantity', 12, 3).notNullable();
    table.decimal('purchase_price', 15, 2).notNullable(); // Renamed from unit_price to match spec
    table.decimal('tax_rate', 5, 2).defaultTo(0);
    table.decimal('tax_amount', 15, 2).defaultTo(0);
    table.decimal('total', 15, 2).notNullable();        // Renamed from total_amount to match spec
    
    table.string('batch_number').nullable();
    table.date('expiry_date').nullable();
    
    table.foreign('purchase_id').references('id').inTable('purchases').onDelete('CASCADE');
    table.foreign('product_id').references('id').inTable('products');
  });

  // ─── Expenses Table ────────────────────────────────────────
  await knex.schema.createTable('expenses', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().index();
    table.uuid('branch_id').notNullable().index();
    
    table.string('category').notNullable().index();
    table.decimal('amount', 15, 2).notNullable();
    table.text('note').nullable();                     // Renamed from notes to match spec
    table.string('payment_mode').notNullable().defaultTo('cash'); // Added to match spec
    table.date('expense_date').notNullable().defaultTo(knex.fn.now());
    
    table.uuid('recorded_by').notNullable();           // Renamed from created_by to match spec
    table.timestamps(true, true);
    table.boolean('is_deleted').defaultTo(false);      // Changed from deleted_at to match project convention
    
    table.foreign('tenant_id').references('id').inTable('tenants');
    table.foreign('branch_id').references('id').inTable('branches');
    
    table.index(['tenant_id', 'is_deleted']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('expenses');
  await knex.schema.dropTableIfExists('purchase_items');
  await knex.schema.dropTableIfExists('purchases');
}
