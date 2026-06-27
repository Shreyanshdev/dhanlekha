import { Knex } from 'knex';

/**
 * Sprint 17 — Audit Logs
 *
 * Records every state-changing API request (POST/PUT/PATCH/DELETE) for
 * compliance, security forensics, and "who changed what" traceability —
 * a baseline requirement for premium ERP parity.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').nullable(); // null for unauthenticated / system actions
    table.uuid('branch_id').nullable();

    table.string('action').notNullable();   // create | update | delete | <method>
    table.string('entity').notNullable();    // resource name derived from path (e.g. 'invoices')
    table.string('entity_id').nullable();     // affected record id when present in the route

    table.string('method').notNullable();     // HTTP verb
    table.string('path').notNullable();        // request path
    table.integer('status_code').notNullable();
    table.string('ip_address').nullable();
    table.text('metadata').nullable();         // JSON blob (query/body summary)

    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'created_at'], 'idx_audit_tenant_time');
    table.index(['tenant_id', 'entity', 'entity_id'], 'idx_audit_entity');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
}
