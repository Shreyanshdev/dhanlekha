import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Products Table (Catalogue)
  await knex.schema.createTable('products', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('barcode').nullable();
    table.integer('gst_rate').notNullable().defaultTo(0);
    table.string('hsn_code').nullable();
    table.string('base_unit').notNullable().defaultTo('pcs');
    table.string('category').nullable();
    
    table.boolean('is_deleted').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id', 'is_deleted']);
    table.index(['tenant_id', 'barcode']); // For fast barcode lookup
    table.index(['tenant_id', 'name']); // For search
  });

  // 2. Inventory Table (Summary Stock)
  await knex.schema.createTable('inventory', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('branch_id').notNullable().references('id').inTable('branches').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    
    table.integer('total_quantity').notNullable().defaultTo(0);
    table.integer('selling_price').notNullable().defaultTo(0); // In paise
    table.integer('purchase_price').notNullable().defaultTo(0); // In paise
    table.integer('min_stock_alert').notNullable().defaultTo(0);
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes & Constraints
    table.unique(['branch_id', 'product_id']);
    table.index(['branch_id', 'total_quantity']); // Find out-of-stock items per branch
  });

  // 3. Inventory Batches Table (Optional Batch Tracking)
  await knex.schema.createTable('inventory_batches', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('branch_id').notNullable().references('id').inTable('branches').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    
    table.string('batch_number').notNullable();
    table.integer('quantity').notNullable().defaultTo(0);
    table.integer('purchase_price').notNullable().defaultTo(0);
    table.integer('selling_price').notNullable().defaultTo(0);
    
    table.date('mfg_date').nullable();
    table.date('exp_date').nullable();

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['product_id', 'exp_date']); // For FEFO (First Expiring First Out)
    table.index(['tenant_id', 'batch_number']);
  });

  // 4. Inventory Logs Table (Audit Trail)
  await knex.schema.createTable('inventory_logs', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('branch_id').notNullable().references('id').inTable('branches').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.uuid('batch_id').nullable().references('id').inTable('inventory_batches').onDelete('SET NULL');
    
    table.enum('change_type', ['purchase', 'sale', 'adjustment', 'return', 'damage']).notNullable();
    table.integer('quantity_change').notNullable(); // Positive or Negative
    table.string('reference_id').nullable(); // E.g., invoice_id
    table.string('notes').nullable();
    
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['tenant_id', 'product_id', 'created_at']);
    table.index(['tenant_id', 'reference_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('inventory_logs');
  await knex.schema.dropTableIfExists('inventory_batches');
  await knex.schema.dropTableIfExists('inventory');
  await knex.schema.dropTableIfExists('products');
}
