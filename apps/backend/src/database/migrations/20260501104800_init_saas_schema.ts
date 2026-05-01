import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ── PLANS ──
  await knex.schema.createTable('plans', (table) => {
    table.string('id').primary(); // 'starter', 'growth', 'enterprise'
    table.string('name').notNullable();
    table.integer('monthly_price').notNullable(); // In paise
    table.timestamps(true, true);
  });

  // ── FEATURE FLAGS ──
  await knex.schema.createTable('feature_flags', (table) => {
    table.string('id').primary(); // 'max_invoices_per_month', 'enable_api'
    table.string('description').notNullable();
    table.enu('type', ['boolean', 'limit']).notNullable();
    table.timestamps(true, true);
  });

  // ── PLAN FEATURES ──
  await knex.schema.createTable('plan_features', (table) => {
    table.string('plan_id').references('id').inTable('plans').onDelete('CASCADE');
    table.string('feature_id').references('id').inTable('feature_flags').onDelete('CASCADE');
    table.integer('limit_value'); // null for boolean type, number for limit type
    table.boolean('is_enabled').defaultTo(true);
    table.primary(['plan_id', 'feature_id']);
    table.timestamps(true, true);
  });

  // ── TENANTS ──
  await knex.schema.createTable('tenants', (table) => {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.string('email').notNullable().unique();
    table.string('phone');
    table.string('plan_id').references('id').inTable('plans').notNullable().defaultTo('starter');
    table.enu('status', ['active', 'suspended', 'cancelled']).defaultTo('active');
    table.boolean('is_deleted').defaultTo(false);
    table.timestamps(true, true);
    
    // Indexes
    table.index(['is_deleted']);
  });

  // ── USERS (Admin/Cashier) ──
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('email').notNullable(); // Enforced unique per tenant via unique index below
    table.string('password_hash').notNullable();
    table.enu('role', ['admin', 'cashier']).defaultTo('cashier');
    table.boolean('is_deleted').defaultTo(false);
    table.timestamps(true, true);

    // Indexes
    table.unique(['tenant_id', 'email']);
    table.index(['tenant_id', 'is_deleted']);
  });

  // ── TENANT OVERRIDES ──
  await knex.schema.createTable('tenant_overrides', (table) => {
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.string('feature_id').references('id').inTable('feature_flags').onDelete('CASCADE');
    table.integer('limit_value');
    table.boolean('is_enabled').defaultTo(true);
    table.primary(['tenant_id', 'feature_id']);
    table.timestamps(true, true);
  });

  // ── USAGE TRACKING ──
  await knex.schema.createTable('usage_tracking', (table) => {
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.string('feature_id').references('id').inTable('feature_flags').onDelete('CASCADE');
    table.string('month_year').notNullable(); // Format: 'YYYY-MM'
    table.integer('used_count').defaultTo(0);
    table.primary(['tenant_id', 'feature_id', 'month_year']);
    table.timestamps(true, true);
  });

  // ── SUBSCRIPTIONS ──
  await knex.schema.createTable('subscriptions', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    table.string('plan_id').references('id').inTable('plans');
    table.string('status').notNullable(); // 'active', 'past_due', 'canceled'
    table.dateTime('current_period_start').notNullable();
    table.dateTime('current_period_end').notNullable();
    table.timestamps(true, true);
    
    // Indexes
    table.index(['tenant_id', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('subscriptions');
  await knex.schema.dropTableIfExists('usage_tracking');
  await knex.schema.dropTableIfExists('tenant_overrides');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('tenants');
  await knex.schema.dropTableIfExists('plan_features');
  await knex.schema.dropTableIfExists('feature_flags');
  await knex.schema.dropTableIfExists('plans');
}
