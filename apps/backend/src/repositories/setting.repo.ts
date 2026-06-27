import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import db from '../config/database';
import type { Setting } from '@dhanlekha/shared';

/**
 * SettingRepository — per-tenant key/value config (`settings` table).
 *
 * The `settings` table has no `is_deleted` column, so this repository does not
 * extend BaseRepository. Every query is still scoped to `tenant_id`.
 */
export class SettingRepository {
  private tenantId: string;
  private trx?: Knex.Transaction;

  constructor(tenantId: string, trx?: Knex.Transaction) {
    this.tenantId = tenantId;
    this.trx = trx;
  }

  private query() {
    return this.trx ? this.trx('settings') : db('settings');
  }

  async findAll(): Promise<Setting[]> {
    return (await this.query().where({ tenant_id: this.tenantId })) as Setting[];
  }

  async findByKey(key: string): Promise<Setting | undefined> {
    return (await this.query()
      .where({ tenant_id: this.tenantId, key })
      .first()) as Setting | undefined;
  }

  /** Insert or update a single key for this tenant. */
  async upsert(key: string, value: string): Promise<void> {
    const existing = await this.findByKey(key);
    if (existing) {
      await this.query()
        .where({ tenant_id: this.tenantId, key })
        .update({ value, updated_at: db.fn.now() });
    } else {
      await this.query().insert({
        id: uuidv4(),
        tenant_id: this.tenantId,
        key,
        value,
      });
    }
  }
}
