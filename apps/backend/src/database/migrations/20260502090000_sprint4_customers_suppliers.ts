import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ─── CUSTOMERS TABLE ───
  await knex.schema.createTable('customers', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    
    table.string('name').notNullable();
    table.string('phone').nullable();
    table.text('address').nullable();
    
    table.decimal('credit_limit', 10, 2).defaultTo(0);
    table.decimal('total_due', 10, 2).defaultTo(0); // Denormalised cache
    
    table.boolean('is_deleted').defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indices
    table.index(['tenant_id', 'is_deleted']);
    table.index(['tenant_id', 'phone']);
  });

  // ─── SUPPLIERS TABLE ───
  await knex.schema.createTable('suppliers', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    
    table.string('name').notNullable();
    table.string('phone').nullable();
    table.text('address').nullable();
    table.string('gst_number').nullable();
    
    table.boolean('is_deleted').defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indices
    table.index(['tenant_id', 'is_deleted']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('suppliers');
  await knex.schema.dropTableIfExists('customers');
}
