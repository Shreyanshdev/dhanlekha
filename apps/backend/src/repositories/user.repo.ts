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
  constructor(tenantId: string, trx?: Knex.Transaction) {
    super(tenantId, 'users', trx);
  }

  // ─── Tenant-Scoped Queries ────────────────────────────────

  /** Find user by email within this tenant */
  async findByEmail(email: string): Promise<User | undefined> {
    return await this.getQuery().where({ email }).first();
  }

  /** List all users, returning only safe columns (no password_hash) */
  async findAllSafe(): Promise<UserPublic[]> {
    return await this.getQuery()
      .select(SAFE_COLUMNS as string[])
      .orderBy('created_at', 'desc');
  }

  /** Find user by ID, returning only safe columns (no password_hash) */
  async findByIdSafe(id: string): Promise<UserPublic | undefined> {
    return await this.getQuery()
      .select(SAFE_COLUMNS as string[])
      .where({ id })
      .first();
  }

  /** Count users with a specific role in this tenant */
  async countByRole(role: 'admin' | 'cashier'): Promise<number> {
    return await this.count({ role });
  }

  // ─── Cross-Tenant Queries (Login only) ────────────────────

  /**
   * Find user by email across ALL tenants.
   * Used ONLY during login (we don't know the tenant yet).
   */
  async findByEmailGlobal(email: string): Promise<User | undefined> {
    return await this.getRawQuery().where({ email }).first();
  }
}
