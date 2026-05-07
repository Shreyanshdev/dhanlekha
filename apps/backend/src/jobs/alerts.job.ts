import { Knex } from 'knex';
import db from '../config/database';
import { AlertRepository } from '../repositories/alert.repo';
import { TenantRepository } from '../repositories/tenant.repo';
import { v4 as uuidv4 } from 'uuid';

export async function generateAlerts() {
  console.log('[Jobs] Starting alert generator...');
  const tenantRepo = new TenantRepository();
  const tenants = await tenantRepo.findAll();

  for (const tenant of tenants) {
    const tenantId = tenant.id;
    const alertRepo = new AlertRepository(tenantId);

    // 1. Check for low_stock
    // Using a default threshold of 10 if not defined per product, though standard schema usually implies it
    // Wait, the schema has `min_stock_alert` defaulting to 0. We'll use that.
    const lowStockItems = await db('inventory')
      .join('products', 'inventory.product_id', 'products.id')
      .where('inventory.tenant_id', tenantId)
      .andWhere('inventory.total_quantity', '<=', db.raw('inventory.min_stock_alert'))
      .select('inventory.id', 'products.name', 'inventory.total_quantity', 'inventory.min_stock_alert', 'inventory.branch_id');

    for (const item of lowStockItems) {
      // Check if unread alert already exists to avoid spam
      const existing = await db('alerts')
        .where({
          tenant_id: tenantId,
          branch_id: item.branch_id,
          alert_type: 'low_stock',
          is_read: false
        })
        .andWhere('message', 'like', `%${item.name}%`)
        .first();

      if (!existing) {
        await alertRepo.create({
          id: uuidv4(),
          tenant_id: tenantId,
          branch_id: item.branch_id,
          alert_type: 'low_stock',
          message: `Stock for ${item.name} is below minimum (${item.total_quantity} remaining)`,
        });
      }
    }

    // 2. Check for payment_due
    // Customers with total_due > 0
    const dueCustomers = await db('customers')
      .where('tenant_id', tenantId)
      .andWhere('total_due', '>', 0)
      .andWhere('is_deleted', false)
      .select('id', 'name', 'total_due');

    for (const customer of dueCustomers) {
      const existing = await db('alerts')
        .where({
          tenant_id: tenantId,
          alert_type: 'payment_due',
          is_read: false
        })
        .andWhere('message', 'like', `%${customer.name}%`)
        .first();

      if (!existing) {
        await alertRepo.create({
          id: uuidv4(),
          tenant_id: tenantId,
          branch_id: null,
          alert_type: 'payment_due',
          message: `Payment due from ${customer.name}: ₹${customer.total_due}`,
        });
      }
    }

    // 3. Check for sync_failed
    const failedSyncs = await db('sync_queue')
      .where('tenant_id', tenantId)
      .andWhere('is_synced', false)
      .whereNotNull('error_message')
      .count('id as count')
      .first() as any;

    if (failedSyncs && failedSyncs.count > 0) {
      const existing = await db('alerts')
        .where({
          tenant_id: tenantId,
          alert_type: 'sync_failed',
          is_read: false
        })
        .first();

      if (!existing) {
        await alertRepo.create({
          id: uuidv4(),
          tenant_id: tenantId,
          branch_id: null,
          alert_type: 'sync_failed',
          message: `There are ${failedSyncs.count} failed sync operations requiring attention.`,
        });
      }
    }
    
    // We can add expiry_soon and high_demand later if logic dictates, 
    // for now we fulfill the core requirements.
  }
  
  console.log('[Jobs] Alert generator finished.');
}
