import type { Knex } from 'knex';

/**
 * Sprint 20 — Financial Statements & Reporting
 *
 *   financial_years   — accounting periods (open/closed)
 *   opening_balances  — per-account opening debit/credit for a financial year
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('financial_years', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');

    table.string('name', 100).notNullable();
    table.string('start_date', 10).notNullable().comment('YYYY-MM-DD inclusive');
    table.string('end_date', 10).notNullable().comment('YYYY-MM-DD inclusive');
    table.enum('status', ['open', 'closed']).notNullable().defaultTo('open');

    table.boolean('is_deleted').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'status'], 'idx_fy_tenant_status');
    table.index(['tenant_id', 'start_date', 'end_date'], 'idx_fy_tenant_dates');
  });

  await knex.schema.createTable('opening_balances', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table
      .uuid('financial_year_id')
      .notNullable()
      .references('id')
      .inTable('financial_years')
      .onDelete('CASCADE');
    table
      .uuid('account_id')
      .notNullable()
      .references('id')
      .inTable('chart_of_accounts');

    table.integer('debit').notNullable().defaultTo(0).comment('Opening debit in paise');
    table.integer('credit').notNullable().defaultTo(0).comment('Opening credit in paise');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['financial_year_id', 'account_id'], {
      indexName: 'uq_opening_balance_fy_account',
    });
    table.index(['tenant_id', 'financial_year_id'], 'idx_opening_balance_tenant_fy');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('opening_balances');
  await knex.schema.dropTableIfExists('financial_years');
}
