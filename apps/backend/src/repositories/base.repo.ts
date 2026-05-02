import { Knex } from 'knex';
import db from '../config/database';

/**
 * Base Repository — the ONLY layer that touches the database.
 *
 * RULES:
 *   1. Services NEVER import `db` directly — they always go through a repository.
 *   2. Every query is automatically scoped to tenant_id + is_deleted=false.
 *   3. Global tables (tenants, plans, feature_flags) override getQuery() in their repos.
 *   4. All methods accept an optional Knex.Transaction for atomic operations.
 */
export class BaseRepository<T> {
  protected tenantId: string;
  protected tableName: string;
  protected trx?: Knex.Transaction;

  constructor(tenantId: string, tableName: string, trx?: Knex.Transaction) {
    this.tenantId = tenantId;
    this.tableName = tableName;
    this.trx = trx;
  }

  // ─── Query Builders ───────────────────────────────────────

  /**
   * Base query builder with tenant isolation + soft-delete filter.
   * Override in child repos for global tables (tenants, plans).
   */
  protected getQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx(this.tableName) : db(this.tableName);
    return qb.where({ tenant_id: this.tenantId, is_deleted: false });
  }

  /**
   * Raw query builder WITHOUT tenant scoping.
   * Use ONLY for cross-tenant lookups (e.g., login email search).
   */
  protected getRawQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx(this.tableName) : db(this.tableName);
    return qb.where({ is_deleted: false });
  }

  /**
   * Raw insert query builder — bypasses getQuery() scope
   * so we can set tenant_id explicitly on the data.
   */
  protected getInsertQuery(): Knex.QueryBuilder {
    return this.trx ? this.trx(this.tableName) : db(this.tableName);
  }

  // ─── CRUD Operations ──────────────────────────────────────

  async findById(id: string): Promise<T | undefined> {
    return await this.getQuery().where({ id }).first();
  }

  async findAll(): Promise<T[]> {
    return await this.getQuery();
  }

  /**
   * Select specific columns only (useful for safe projections that exclude password_hash).
   */
  async findAllSelect(columns: string[]): Promise<Partial<T>[]> {
    return await this.getQuery().select(columns).orderBy('created_at', 'desc');
  }

  async findByIdSelect(id: string, columns: string[]): Promise<Partial<T> | undefined> {
    return await this.getQuery().select(columns).where({ id }).first();
  }

  /**
   * Create a new record.
   * We use Partial<T> to allow omitting fields with database defaults (is_deleted, created_at).
   */
  async create(data: Partial<T>): Promise<void> {
    await this.getInsertQuery().insert({
      ...data,
      tenant_id: this.tenantId,
    });
  }

  /**
   * Update an existing record by ID.
   * Partial<T> allows updating only specific fields.
   */
  async update(id: string, data: Partial<T>): Promise<number> {
    return await this.getQuery().where({ id }).update(data);
  }

  async softDelete(id: string): Promise<number> {
    return await this.getQuery().where({ id }).update({ is_deleted: true });
  }

  // ─── Aggregation ──────────────────────────────────────────

  /**
   * Count rows matching optional filters (always tenant-scoped).
   */
  async count(filters: Record<string, any> = {}): Promise<number> {
    const result = await this.getQuery()
      .where(filters)
      .count('id as count')
      .first();
    return Number(result?.count ?? 0);
  }
}

/**
 * BranchScopedRepository — for tables that are isolated per branch (Inventory, Invoices, etc.).
 * Automatically adds branch_id to all queries.
 */
export class BranchScopedRepository<T> extends BaseRepository<T> {
  protected branchId: string;

  constructor(tenantId: string, branchId: string, tableName: string, trx?: Knex.Transaction) {
    super(tenantId, tableName, trx);
    this.branchId = branchId;
  }

  protected getQuery(): Knex.QueryBuilder {
    return super.getQuery().where({ branch_id: this.branchId });
  }

  protected getRawQuery(): Knex.QueryBuilder {
    return super.getRawQuery().where({ branch_id: this.branchId });
  }

  async create(data: Partial<T>): Promise<void> {
    await this.getInsertQuery().insert({
      ...data,
      tenant_id: this.tenantId,
      branch_id: this.branchId,
    });
  }
}
