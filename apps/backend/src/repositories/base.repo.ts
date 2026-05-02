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

  constructor(tenantId: string, tableName: string) {
    this.tenantId = tenantId;
    this.tableName = tableName;
  }

  // ─── Query Builders ───────────────────────────────────────

  /**
   * Base query builder with tenant isolation + soft-delete filter.
   * Override in child repos for global tables (tenants, plans).
   */
  protected getQuery(trx?: Knex.Transaction): Knex.QueryBuilder {
    const qb = trx ? trx(this.tableName) : db(this.tableName);
    return qb.where({ tenant_id: this.tenantId, is_deleted: false });
  }

  /**
   * Raw query builder WITHOUT tenant scoping.
   * Use ONLY for cross-tenant lookups (e.g., login email search).
   */
  protected getRawQuery(trx?: Knex.Transaction): Knex.QueryBuilder {
    const qb = trx ? trx(this.tableName) : db(this.tableName);
    return qb.where({ is_deleted: false });
  }

  /**
   * Raw insert query builder — bypasses getQuery() scope
   * so we can set tenant_id explicitly on the data.
   */
  protected getInsertQuery(trx?: Knex.Transaction): Knex.QueryBuilder {
    return trx ? trx(this.tableName) : db(this.tableName);
  }

  // ─── CRUD Operations ──────────────────────────────────────

  async findById(id: string, trx?: Knex.Transaction): Promise<T | undefined> {
    return await this.getQuery(trx).where({ id }).first();
  }

  async findAll(trx?: Knex.Transaction): Promise<T[]> {
    return await this.getQuery(trx);
  }

  /**
   * Select specific columns only (useful for safe projections that exclude password_hash).
   */
  async findAllSelect(columns: string[], trx?: Knex.Transaction): Promise<Partial<T>[]> {
    return await this.getQuery(trx).select(columns).orderBy('created_at', 'desc');
  }

  async findByIdSelect(id: string, columns: string[], trx?: Knex.Transaction): Promise<Partial<T> | undefined> {
    return await this.getQuery(trx).select(columns).where({ id }).first();
  }

  async create(data: Partial<T>, trx?: Knex.Transaction): Promise<void> {
    await this.getInsertQuery(trx).insert({
      ...data,
      tenant_id: this.tenantId,
    });
  }

  async update(id: string, data: Partial<T>, trx?: Knex.Transaction): Promise<number> {
    return await this.getQuery(trx).where({ id }).update(data);
  }

  async softDelete(id: string, trx?: Knex.Transaction): Promise<number> {
    return await this.getQuery(trx).where({ id }).update({ is_deleted: true });
  }

  // ─── Aggregation ──────────────────────────────────────────

  /**
   * Count rows matching optional filters (always tenant-scoped).
   */
  async count(filters: Record<string, any> = {}, trx?: Knex.Transaction): Promise<number> {
    const result = await this.getQuery(trx)
      .where(filters)
      .count('id as count')
      .first();
    return Number(result?.count ?? 0);
  }
}
