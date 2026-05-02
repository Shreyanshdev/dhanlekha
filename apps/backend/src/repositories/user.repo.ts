import { Knex } from 'knex';
import { BaseRepository } from './base.repo';
import type { User, UserPublic } from '@dhanlekha/shared';

/** Columns safe to return to the client (never expose password_hash) */
const SAFE_COLUMNS: Array<keyof UserPublic> = ['id', 'tenant_id', 'name', 'email', 'role', 'created_at'];

/**
 * UserRepository — handles queries against the `users` table.
 *
 * Users are always scoped to a tenant_id (via BaseRepository.getQuery).
 */
export class UserRepository extends BaseRepository<User> {
  constructor(tenantId: string) {
    super(tenantId, 'users');
  }

  // ─── Tenant-Scoped Queries ────────────────────────────────

  /** Find user by email within this tenant */
  async findByEmail(email: string, trx?: Knex.Transaction): Promise<User | undefined> {
    return await this.getQuery(trx).where({ email }).first();
  }

  /** List all users, returning only safe columns (no password_hash) */
  async findAllSafe(trx?: Knex.Transaction): Promise<UserPublic[]> {
    return await this.getQuery(trx)
      .select(SAFE_COLUMNS as string[])
      .orderBy('created_at', 'desc');
  }

  /** Find user by ID, returning only safe columns (no password_hash) */
  async findByIdSafe(id: string, trx?: Knex.Transaction): Promise<UserPublic | undefined> {
    return await this.getQuery(trx)
      .select(SAFE_COLUMNS as string[])
      .where({ id })
      .first();
  }

  /** Count users with a specific role in this tenant */
  async countByRole(role: 'admin' | 'cashier', trx?: Knex.Transaction): Promise<number> {
    return await this.count({ role }, trx);
  }

  // ─── Cross-Tenant Queries (Login only) ────────────────────

  /**
   * Find user by email across ALL tenants.
   * Used ONLY during login (we don't know the tenant yet).
   */
  async findByEmailGlobal(email: string, trx?: Knex.Transaction): Promise<User | undefined> {
    return await this.getRawQuery(trx).where({ email }).first();
  }
}
