import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing entries
  await knex('plan_features').del();
  await knex('feature_flags').del();
  await knex('plans').del();

  // 1. Insert Plans
  await knex('plans').insert([
    { id: 'starter', name: 'Starter', monthly_price: 99900 },    // ₹999.00
    { id: 'growth', name: 'Growth', monthly_price: 249900 },    // ₹2499.00
    { id: 'enterprise', name: 'Enterprise', monthly_price: 499900 }, // ₹4999.00
  ]);

  // 2. Insert Feature Flags
  await knex('feature_flags').insert([
    { id: 'max_invoices_per_month', description: 'Maximum invoices allowed per month', type: 'limit' },
    { id: 'max_users', description: 'Maximum staff users allowed', type: 'limit' },
    { id: 'enable_api', description: 'Enable developer API access', type: 'boolean' },
    { id: 'enable_ai', description: 'Enable AI product parsing', type: 'boolean' },
  ]);

  // 3. Insert Plan Features
  await knex('plan_features').insert([
    // Starter Plan
    { plan_id: 'starter', feature_id: 'max_invoices_per_month', limit_value: 100, is_enabled: true },
    { plan_id: 'starter', feature_id: 'max_users', limit_value: 1, is_enabled: true },
    { plan_id: 'starter', feature_id: 'enable_api', limit_value: null, is_enabled: false },
    { plan_id: 'starter', feature_id: 'enable_ai', limit_value: null, is_enabled: false },

    // Growth Plan
    { plan_id: 'growth', feature_id: 'max_invoices_per_month', limit_value: 1000, is_enabled: true },
    { plan_id: 'growth', feature_id: 'max_users', limit_value: 5, is_enabled: true },
    { plan_id: 'growth', feature_id: 'enable_api', limit_value: null, is_enabled: false },
    { plan_id: 'growth', feature_id: 'enable_ai', limit_value: null, is_enabled: true },

    // Enterprise Plan
    { plan_id: 'enterprise', feature_id: 'max_invoices_per_month', limit_value: 999999, is_enabled: true }, // Unlimited
    { plan_id: 'enterprise', feature_id: 'max_users', limit_value: 999999, is_enabled: true }, // Unlimited
    { plan_id: 'enterprise', feature_id: 'enable_api', limit_value: null, is_enabled: true },
    { plan_id: 'enterprise', feature_id: 'enable_ai', limit_value: null, is_enabled: true },
  ]);
}
