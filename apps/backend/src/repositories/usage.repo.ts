import { Knex } from 'knex';
import db from '../config/database';

/**
 * UsageRepository — tracks per-tenant monthly consumption of metered features
 * (e.g. `max_invoices_per_month`).
 *
 * The `usage_tracking` table has a composite primary key of
 * (tenant_id, feature_id, month_year) and is NOT soft-deletable, so it does not
 * extend BaseRepository. A missing row for the current month is treated as 0.
 */
export class UsageRepository {
  private tenantId: string;
  private trx?: Knex.Transaction;

  constructor(tenantId: string, trx?: Knex.Transaction) {
    this.tenantId = tenantId;
    this.trx = trx;
  }

  private query() {
    return this.trx ? this.trx('usage_tracking') : db('usage_tracking');
  }

  /** Current period in `YYYY-MM` format. */
  static currentPeriod(): string {
    return new Date().toISOString().slice(0, 7);
  }

  /** Used count for a feature in the current (or given) month — 0 if no row. */
  async getUsedCount(featureId: string, monthYear: string = UsageRepository.currentPeriod()): Promise<number> {
    const row = await this.query()
      .where({ tenant_id: this.tenantId, feature_id: featureId, month_year: monthYear })
      .first();
    return Number(row?.used_count ?? 0);
  }

  /**
   * Increment usage for the current month by `amount`, inserting the row if it
   * does not yet exist. Portable across SQLite and PostgreSQL.
   */
  async increment(featureId: string, amount = 1): Promise<void> {
    const monthYear = UsageRepository.currentPeriod();
    const existing = await this.query()
      .where({ tenant_id: this.tenantId, feature_id: featureId, month_year: monthYear })
      .first();

    if (existing) {
      await this.query()
        .where({ tenant_id: this.tenantId, feature_id: featureId, month_year: monthYear })
        .increment('used_count', amount);
    } else {
      await this.query().insert({
        tenant_id: this.tenantId,
        feature_id: featureId,
        month_year: monthYear,
        used_count: amount,
      });
    }
  }
}
