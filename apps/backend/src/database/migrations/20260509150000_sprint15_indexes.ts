import { Knex } from 'knex';

/**
 * Sprint 15: Performance Optimisation — Missing Indexes
 *
 * Adds all mandatory indexes from db.md Section 13 that were not
 * created in their original migration files.
 *
 * Index naming convention: idx_{table}_{columns}
 */
export async function up(knex: Knex): Promise<void> {
  // Helper: create index only if it doesn't already exist (SQLite safe)
  async function addIndex(table: string, columns: string[], name: string) {
    const hasTable = await knex.schema.hasTable(table);
    if (!hasTable) return;
    try {
      await knex.schema.alterTable(table, (t) => {
        t.index(columns, name);
      });
    } catch {
      // Index already exists — skip silently
    }
  }

  // ─── Users ───
  await addIndex('users', ['tenant_id'], 'idx_users_tenant');

  // ─── Customers ───
  await addIndex('customers', ['tenant_id'], 'idx_customers_tenant');
  await addIndex('customers', ['phone'], 'idx_customers_phone');

  // ─── Suppliers ───
  await addIndex('suppliers', ['tenant_id'], 'idx_suppliers_tenant');

  // ─── Products ───
  await addIndex('products', ['tenant_id'], 'idx_products_tenant');
  await addIndex('products', ['barcode'], 'idx_products_barcode');
  await addIndex('products', ['tenant_id', 'category'], 'idx_products_category');

  // ─── Inventory ───
  await addIndex('inventory', ['product_id'], 'idx_inventory_product');

  // ─── Inventory Batches ───
  await addIndex('inventory_batches', ['product_id'], 'idx_inv_batches_product');
  await addIndex('inventory_batches', ['exp_date'], 'idx_inv_batches_expiry');

  // ─── Inventory Logs ───
  await addIndex('inventory_logs', ['product_id', 'created_at'], 'idx_inv_logs_product');

  // ─── Invoices ───
  await addIndex('invoices', ['tenant_id', 'created_at'], 'idx_invoices_tenant_date');
  await addIndex('invoices', ['customer_id'], 'idx_invoices_customer');
  await addIndex('invoices', ['tenant_id', 'status'], 'idx_invoices_status');

  // ─── Invoice Items ───
  await addIndex('invoice_items', ['invoice_id'], 'idx_invoice_items_invoice');
  await addIndex('invoice_items', ['product_id'], 'idx_invoice_items_product');

  // ─── Payments ───
  await addIndex('payments', ['tenant_id', 'created_at'], 'idx_payments_tenant_date');
  await addIndex('payments', ['customer_id'], 'idx_payments_customer_fk');

  // ─── Payment Allocations ───
  await addIndex('payment_allocations', ['payment_id'], 'idx_allocations_payment_fk');
  await addIndex('payment_allocations', ['invoice_id'], 'idx_allocations_invoice_fk');

  // ─── Customer Ledger ───
  await addIndex('customer_ledger', ['customer_id', 'created_at'], 'idx_ledger_customer_date');
  await addIndex('customer_ledger', ['tenant_id'], 'idx_ledger_tenant');

  // ─── Ledger Snapshots ───
  await addIndex('ledger_snapshots', ['customer_id', 'snapshot_date'], 'idx_snapshots_customer_date');

  // ─── Purchases ───
  await addIndex('purchases', ['tenant_id', 'created_at'], 'idx_purchases_tenant');
  await addIndex('purchases', ['supplier_id'], 'idx_purchases_supplier');

  // ─── Purchase Items ───
  await addIndex('purchase_items', ['purchase_id'], 'idx_purchase_items_purchase');

  // ─── Expenses ───
  await addIndex('expenses', ['tenant_id', 'created_at'], 'idx_expenses_tenant_date');

  // ─── Alerts ───
  await addIndex('alerts', ['tenant_id', 'is_read'], 'idx_alerts_tenant_read_perf');

  // ─── Sync Queue ───
  await addIndex('sync_queue', ['tenant_id', 'is_synced'], 'idx_sync_tenant_synced');
  await addIndex('sync_queue', ['device_id', 'version'], 'idx_sync_device_version');

  // ─── Daily Metrics ───
  await addIndex('daily_metrics', ['tenant_id', 'date'], 'idx_metrics_tenant_date');

  // ─── Plan Features ───
  await addIndex('plan_features', ['plan_id', 'feature_id'], 'idx_plan_features_plan');

  // ─── Usage Tracking ───
  await addIndex('usage_tracking', ['tenant_id', 'feature_id', 'period'], 'idx_usage_tracking');

  // ─── Tenant Overrides ───
  await addIndex('tenant_overrides', ['tenant_id', 'feature_id'], 'idx_overrides_tenant');

  // ─── Subscriptions ───
  await addIndex('subscriptions', ['tenant_id', 'status'], 'idx_subscriptions_tenant');

  // ─── Product AI Data ───
  await addIndex('product_ai_data', ['product_id'], 'idx_product_ai_product');
}

export async function down(knex: Knex): Promise<void> {
  // Indexes are safe to leave in place on rollback — they don't break anything.
  // SQLite doesn't support DROP INDEX IF EXISTS within alterTable easily,
  // so we skip cleanup to avoid migration failures.
}
