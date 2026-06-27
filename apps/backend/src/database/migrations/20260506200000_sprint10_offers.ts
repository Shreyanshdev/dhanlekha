import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ─── Offers Table ──────────────────────────────────────────
  await knex.schema.createTable('offers', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().index();
    table.uuid('branch_id').nullable().index(); // NULL = applies to all branches

    table.string('name').notNullable();
    table.enum('offer_type', ['flat', 'percentage', 'bogo', 'bundle']).notNullable();
    table.decimal('discount_value', 10, 2).notNullable(); // Amount or percentage depending on type
    table.enum('applies_to', ['product', 'category', 'invoice', 'customer']).notNullable();
    table.uuid('applies_to_id').nullable(); // FK to product/customer; NULL for invoice/category
    table.string('applies_to_category').nullable(); // Category name when applies_to='category'

    table.decimal('min_purchase_amount', 10, 2).notNullable().defaultTo(0);
    table.integer('max_uses').nullable(); // NULL = unlimited
    table.integer('used_count').notNullable().defaultTo(0);
    table.integer('buy_quantity').nullable(); // For BOGO: buy N
    table.integer('get_quantity').nullable(); // For BOGO: get M free

    table.date('valid_from').notNullable();
    table.date('valid_until').notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);

    table.boolean('is_deleted').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.foreign('tenant_id').references('id').inTable('tenants');
    table.foreign('branch_id').references('id').inTable('branches');

    // Performance indexes
    table.index(['tenant_id', 'is_deleted']);
    table.index(['tenant_id', 'is_active', 'valid_from', 'valid_until'], 'idx_offers_active_range');
    table.index(['applies_to', 'applies_to_id'], 'idx_offers_applies_to');
  });

  // ─── Add offer_id to invoice_items ─────────────────────────
  await knex.schema.alterTable('invoice_items', (table) => {
    table.uuid('offer_id').nullable().references('id').inTable('offers').onDelete('SET NULL');
    table.index(['offer_id'], 'idx_invoice_items_offer');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('invoice_items', (table) => {
    table.dropIndex(['offer_id'], 'idx_invoice_items_offer');
    table.dropColumn('offer_id');
  });
  await knex.schema.dropTableIfExists('offers');
}
