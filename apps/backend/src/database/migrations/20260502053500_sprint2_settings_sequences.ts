import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── SETTINGS — per-tenant key-value config ──
  await knex.schema.createTable('settings', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.string('key').notNullable();
    table.text('value').notNullable();
    table.timestamps(true, true);

    // Each tenant can only have one value per key
    table.unique(['tenant_id', 'key']);
    table.index(['tenant_id']);
  });

  // ── INVOICE SEQUENCES — thread-safe invoice number generator ──
  await knex.schema.createTable('invoice_sequences', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('branch_id').references('id').inTable('branches').onDelete('CASCADE');
    table.string('prefix').notNullable().defaultTo('INV');
    table.integer('next_number').notNullable().defaultTo(1);
    table.timestamps(true, true);

    // Each branch has its own sequence
    table.unique(['tenant_id', 'branch_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('invoice_sequences');
  await knex.schema.dropTableIfExists('settings');
}
