import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('daily_metrics', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.uuid('branch_id').nullable(); // Null if aggregated tenant-wide or specific to a branch
    table.date('date').notNullable();
    table.decimal('total_sales', 10, 2).notNullable().defaultTo(0);
    table.decimal('total_purchases', 10, 2).notNullable().defaultTo(0);
    table.decimal('total_expenses', 10, 2).notNullable().defaultTo(0);
    table.decimal('total_profit', 10, 2).notNullable().defaultTo(0);
    table.integer('invoices_count').notNullable().defaultTo(0);
    table.integer('new_customers_count').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Foreign Keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.foreign('branch_id').references('id').inTable('branches').onDelete('CASCADE');

    // Indexes
    table.index(['tenant_id', 'date'], 'idx_daily_metrics_tenant_date');
    table.unique(['tenant_id', 'branch_id', 'date'], { indexName: 'uq_daily_metrics_tenant_branch_date' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('daily_metrics');
}
