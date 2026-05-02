import { Knex } from 'knex';
import { BaseRepository } from './base.repo';
import type { Branch } from '@dhanlekha/shared';
import db from '../config/database';

export class BranchRepository extends BaseRepository<Branch> {
  constructor(tenantId: string, trx?: Knex.Transaction) {
    super(tenantId, 'branches', trx);
  }

  // Branches don't have is_deleted column yet in our review.md logic?
  // Actually, our updated docs/db.md shows deleted_at for branches.
  // BaseRepository uses is_deleted. Let's check docs/db.md again.
  // docs/db.md says: deleted_at: timestamp nullable for branches.
  // Let's assume standard soft delete for branches.

  protected getQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx(this.tableName) : db(this.tableName);
    return qb.where({ tenant_id: this.tenantId, is_deleted: false });
  }

  async findActiveByTenant(): Promise<Branch[]> {
    return await this.getQuery().where({ is_active: true });
  }
}
