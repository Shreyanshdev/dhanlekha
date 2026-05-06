import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ─── Sync Queue Table ──────────────────────────────────────
  // Append-only change log for offline-first operation.
  // Every local insert/update/delete is recorded here.
  // The sync service replays these against the cloud in created_at order.
  await knex.schema.createTable('sync_queue', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.string('table_name').notNullable();           // e.g. 'invoices', 'inventory'
    table.uuid('record_id').notNullable();               // PK of the modified record
    table.string('action').notNullable();                 // 'insert', 'update', 'delete'
    table.integer('version').notNullable();               // Monotonic per device for conflict detection
    table.string('device_id').notNullable();              // Which device made this change
    table.string('conflict_strategy').notNullable().defaultTo('server_wins'); // server_wins | client_wins | manual
    table.text('payload').nullable();                    // JSON-stringified snapshot of changed data for replay
    table.boolean('is_synced').notNullable().defaultTo(false);
    table.text('error_message').nullable();               // Populated on failed sync attempt
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('synced_at').nullable();

    // Foreign keys
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');

    // Performance indexes (from db.md spec)
    table.index(['tenant_id', 'is_synced'], 'idx_sync_queue_tenant_synced');
    table.index(['device_id', 'version'], 'idx_sync_queue_device');
    table.index(['tenant_id', 'created_at'], 'idx_sync_queue_tenant_created');
    table.index(['table_name', 'record_id'], 'idx_sync_queue_table_record');
  });

  // ─── Sync Devices Registry ─────────────────────────────────
  // Tracks all devices that have ever synced for a tenant.
  // Enables per-device version tracking and last-seen monitoring.
  await knex.schema.createTable('sync_devices', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    table.string('device_id').notNullable();              // Client-generated device identifier
    table.string('device_name').nullable();                // Human-readable name (e.g. "Counter 1 PC")
    table.integer('last_version').notNullable().defaultTo(0);  // Latest version synced from this device
    table.timestamp('last_seen_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.unique(['tenant_id', 'device_id'], { indexName: 'uq_sync_devices_tenant_device' });
    table.index(['tenant_id'], 'idx_sync_devices_tenant');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sync_devices');
  await knex.schema.dropTableIfExists('sync_queue');
}
