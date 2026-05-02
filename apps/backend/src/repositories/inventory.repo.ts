import { Knex } from 'knex';
import { BaseRepository, BranchScopedRepository } from './base.repo';
import type { Inventory, InventoryBatch, InventoryLog } from '@dhanlekha/shared';
import db from '../config/database';

export class InventoryRepository extends BranchScopedRepository<Inventory> {
  constructor(tenantId: string, branchId: string, trx?: Knex.Transaction) {
    // Inventory uses 'product_id' as its primary key, not 'id'
    super(tenantId, branchId, 'inventory', trx);
  }

  public getQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx(this.tableName) : db(this.tableName);
    return qb.where({ tenant_id: this.tenantId, branch_id: this.branchId }); // No is_deleted column
  }

  protected getRawQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx(this.tableName) : db(this.tableName);
    return qb.where({ branch_id: this.branchId });
  }

  /** 
   * Inventory primary key is product_id, override findById 
   */
  async findById(productId: string): Promise<Inventory | undefined> {
    return await this.getQuery().where({ product_id: productId }).first();
  }

  /**
   * Update by product_id
   */
  async update(productId: string, data: Partial<Inventory>): Promise<number> {
    return await this.getQuery().where({ product_id: productId }).update(data);
  }

  /**
   * Inventory doesn't have soft delete or `id`.
   */
  async softDelete(): Promise<number> {
    throw new Error('Inventory cannot be soft deleted independently.');
  }

  async findByIdSelect(): Promise<Partial<Inventory> | undefined> {
    throw new Error('Use findById instead for Inventory.');
  }

  /**
   * Get low stock items
   */
  async getLowStock(limit: number = 50): Promise<Inventory[]> {
    return await this.getQuery()
      .whereRaw('total_quantity <= min_stock_alert')
      .orderBy('total_quantity', 'asc')
      .limit(limit);
  }

  /**
   * Increment stock (atomic)
   */
  async incrementStock(productId: string, quantity: number): Promise<void> {
    await this.getQuery()
      .where({ product_id: productId })
      .increment('total_quantity', quantity);
  }

  /**
   * Decrement stock (atomic)
   */
  async decrementStock(productId: string, quantity: number): Promise<void> {
    await this.getQuery()
      .where({ product_id: productId })
      .decrement('total_quantity', quantity);
  }
}

// ─── Batch Repository ───────────────────────────────────────

export class InventoryBatchRepository extends BranchScopedRepository<InventoryBatch> {
  constructor(tenantId: string, branchId: string, trx?: Knex.Transaction) {
    super(tenantId, branchId, 'inventory_batches', trx);
  }

  public getQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx(this.tableName) : db(this.tableName);
    return qb.where({ tenant_id: this.tenantId, branch_id: this.branchId }); // No is_deleted column
  }

  protected getRawQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx(this.tableName) : db(this.tableName);
    return qb.where({ branch_id: this.branchId });
  }

  /**
   * Inventory batches do not support soft delete
   */
  async softDelete(): Promise<number> {
    throw new Error('Inventory batches cannot be soft deleted.');
  }

  /** Get all batches for a specific product */
  async findByProductId(productId: string): Promise<InventoryBatch[]> {
    return await this.getQuery()
      .where({ product_id: productId })
      .orderBy('exp_date', 'asc') // Default order: First Expiring First Out (FEFO)
      .orderBy('created_at', 'asc'); // Fallback to FIFO if no exp_date
  }

  /** Find specific batch */
  async findByBatchNumber(productId: string, batchNumber: string): Promise<InventoryBatch | undefined> {
    return await this.getQuery()
      .where({ product_id: productId, batch_number: batchNumber })
      .first();
  }
}

// ─── Log/Audit Repository ───────────────────────────────────

export class InventoryLogRepository extends BranchScopedRepository<InventoryLog> {
  constructor(tenantId: string, branchId: string, trx?: Knex.Transaction) {
    super(tenantId, branchId, 'inventory_logs', trx);
  }

  public getQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx(this.tableName) : db(this.tableName);
    return qb.where({ tenant_id: this.tenantId, branch_id: this.branchId }); // No is_deleted column
  }

  protected getRawQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx(this.tableName) : db(this.tableName);
    return qb.where({ branch_id: this.branchId });
  }

  /** 
   * inventory_logs is an append-only audit trail table.
   * We override update and softDelete to prevent mutations.
   */
  async update(): Promise<number> {
    throw new Error('Inventory logs are immutable and cannot be updated.');
  }

  async softDelete(): Promise<number> {
    throw new Error('Inventory logs are immutable and cannot be deleted.');
  }

  /** Get audit trail for a product */
  async getLogsForProduct(productId: string, limit: number = 50): Promise<InventoryLog[]> {
    return await this.getQuery()
      .where({ product_id: productId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }
}
