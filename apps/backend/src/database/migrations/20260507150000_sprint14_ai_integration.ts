import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create product_ai_data table
  await knex.schema.createTable('product_ai_data', (table) => {
    table.uuid('id').primary();
    table.uuid('product_id').notNullable().unique();
    table.string('normalized_name').notNullable();
    table.string('predicted_category').nullable();
    table.json('tags').nullable();
    table.decimal('price_suggestion', 10, 2).nullable();
    table.decimal('confidence_score', 4, 3).nullable();
    table.timestamp('last_used_at').nullable();
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Foreign keys
    table.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');

    // Index for fuzzy search lookups
    table.index(['product_id'], 'idx_product_ai_data_product');
  });

  // 2. Add granular AI feature flags
  const existingFlags = await knex('feature_flags').select('id');
  const existingIds = existingFlags.map((f: any) => f.id);

  const aiFlags = [
    { id: 'ai_product_entry', description: 'AI-powered product name parsing and auto-entry', type: 'boolean' },
    { id: 'ai_smart_suggestions', description: 'AI-powered smart product suggestions during billing', type: 'boolean' },
    { id: 'ai_voice_billing', description: 'Convert speech transcript to invoice items', type: 'boolean' },
    { id: 'ai_demand_prediction', description: 'Demand forecasting and low-stock prediction', type: 'boolean' },
  ];

  const newFlags = aiFlags.filter(f => !existingIds.includes(f.id));
  if (newFlags.length > 0) {
    await knex('feature_flags').insert(newFlags);
  }

  // 3. Map AI features to plans
  const aiPlanFeatures = [
    // Starter — all AI features OFF
    { plan_id: 'starter', feature_id: 'ai_product_entry', limit_value: null, is_enabled: false },
    { plan_id: 'starter', feature_id: 'ai_smart_suggestions', limit_value: null, is_enabled: false },
    { plan_id: 'starter', feature_id: 'ai_voice_billing', limit_value: null, is_enabled: false },
    { plan_id: 'starter', feature_id: 'ai_demand_prediction', limit_value: null, is_enabled: false },

    // Growth — product entry + suggestions ON
    { plan_id: 'growth', feature_id: 'ai_product_entry', limit_value: null, is_enabled: true },
    { plan_id: 'growth', feature_id: 'ai_smart_suggestions', limit_value: null, is_enabled: true },
    { plan_id: 'growth', feature_id: 'ai_voice_billing', limit_value: null, is_enabled: false },
    { plan_id: 'growth', feature_id: 'ai_demand_prediction', limit_value: null, is_enabled: false },

    // Enterprise — ALL AI features ON
    { plan_id: 'enterprise', feature_id: 'ai_product_entry', limit_value: null, is_enabled: true },
    { plan_id: 'enterprise', feature_id: 'ai_smart_suggestions', limit_value: null, is_enabled: true },
    { plan_id: 'enterprise', feature_id: 'ai_voice_billing', limit_value: null, is_enabled: true },
    { plan_id: 'enterprise', feature_id: 'ai_demand_prediction', limit_value: null, is_enabled: true },
  ];

  for (const pf of aiPlanFeatures) {
    const exists = await knex('plan_features')
      .where({ plan_id: pf.plan_id, feature_id: pf.feature_id })
      .first();
    if (!exists) {
      await knex('plan_features').insert(pf);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('product_ai_data');

  const aiFeatureIds = ['ai_product_entry', 'ai_smart_suggestions', 'ai_voice_billing', 'ai_demand_prediction'];
  await knex('plan_features').whereIn('feature_id', aiFeatureIds).del();
  await knex('feature_flags').whereIn('id', aiFeatureIds).del();
}
