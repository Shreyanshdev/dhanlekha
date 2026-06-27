import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('alerts', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.uuid('branch_id').nullable(); // Some alerts are tenant-wide
    table.string('alert_type').notNullable(); // 'low_stock', 'payment_due', 'high_demand', 'expiry_soon', 'sync_failed'
    table.text('message').notNullable();
    table.boolean('is_read').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Foreign Keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.foreign('branch_id').references('id').inTable('branches').onDelete('CASCADE');

    // Indexes
    table.index(['tenant_id', 'is_read'], 'idx_alerts_tenant_read');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('alerts');
}
