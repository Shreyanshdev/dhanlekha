import type { Knex } from 'knex';

/**
 * Sprint 18 — Double-Entry General Ledger
 *
 * Introduces the financial source of truth:
 *   - chart_of_accounts : per-tenant ledger accounts (asset/liability/income/expense/equity)
 *   - journal_entries   : a balanced posting header (one per money event)
 *   - journal_lines     : the debit/credit legs (SUM(debit) === SUM(credit))
 *
 * All monetary columns are integer paise, consistent with utils/money.ts.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chart_of_accounts', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');

    table.string('account_code', 20).notNullable();
    table.string('name', 150).notNullable();
    table.enum('account_type', ['asset', 'liability', 'income', 'expense', 'equity']).notNullable();
    table.uuid('parent_id').nullable(); // self-reference (tree); no hard FK to allow flexible ordering
    table.boolean('is_system').notNullable().defaultTo(false); // seeded accounts that flows depend on

    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('is_deleted').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'account_code'], { indexName: 'uq_coa_tenant_code' });
    table.index(['tenant_id', 'account_type'], 'idx_coa_tenant_type');
  });

  await knex.schema.createTable('journal_entries', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('branch_id').nullable();

    table.string('entry_date', 10).notNullable().comment('YYYY-MM-DD posting date');
    table.string('narration', 500).nullable();
    table.string('reference_type', 40).notNullable().comment('invoice | payment | purchase | expense | manual');
    table.uuid('reference_id').nullable().comment('id of the source document, if any');
    table.enum('status', ['posted', 'void']).notNullable().defaultTo('posted');

    table.uuid('created_by').nullable();
    table.boolean('is_deleted').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'entry_date'], 'idx_journal_tenant_date');
    table.index(['tenant_id', 'reference_type', 'reference_id'], 'idx_journal_reference');
  });

  await knex.schema.createTable('journal_lines', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('journal_entry_id').notNullable().references('id').inTable('journal_entries').onDelete('CASCADE');
    table.uuid('account_id').notNullable().references('id').inTable('chart_of_accounts');

    table.integer('debit').notNullable().defaultTo(0).comment('Debit amount in paise');
    table.integer('credit').notNullable().defaultTo(0).comment('Credit amount in paise');

    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'account_id'], 'idx_jline_account');
    table.index(['journal_entry_id'], 'idx_jline_entry');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('journal_lines');
  await knex.schema.dropTableIfExists('journal_entries');
  await knex.schema.dropTableIfExists('chart_of_accounts');
}
