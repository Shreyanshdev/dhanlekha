import { Knex } from 'knex';
import db from '../config/database';
import type { Plan, Subscription } from '@dhanlekha/shared';

/**
 * SubscriptionRepository — manages the `subscriptions` table plus read access to
 * the global `plans` table.
 *
 * `subscriptions` has no `is_deleted` column, so this repository does not extend
 * BaseRepository; all queries are scoped to `tenant_id` explicitly.
 */
export class SubscriptionRepository {
  private tenantId: string;
  private trx?: Knex.Transaction;

  constructor(tenantId: string, trx?: Knex.Transaction) {
    this.tenantId = tenantId;
    this.trx = trx;
  }

  private query() {
    return this.trx ? this.trx('subscriptions') : db('subscriptions');
  }

  /** The tenant's most recent subscription record (if any). */
  async getCurrent(): Promise<Subscription | undefined> {
    return (await this.query()
      .where({ tenant_id: this.tenantId })
      .orderBy('current_period_start', 'desc')
      .first()) as Subscription | undefined;
  }

  async create(sub: Subscription): Promise<void> {
    await this.query().insert(sub);
  }

  async update(id: string, data: Partial<Subscription>): Promise<void> {
    await this.query().where({ tenant_id: this.tenantId, id }).update(data);
  }

  // ─── Global plans table (read-only) ───

  async findPlan(planId: string): Promise<Plan | undefined> {
    const qb = this.trx ? this.trx('plans') : db('plans');
    return (await qb.where({ id: planId }).first()) as Plan | undefined;
  }

  async listPlans(): Promise<Plan[]> {
    const qb = this.trx ? this.trx('plans') : db('plans');
    return (await qb.orderBy('monthly_price', 'asc')) as Plan[];
  }

  /** Enabled `limit`-type features for a plan, with their configured limits. */
  async getPlanLimitFeatures(
    planId: string
  ): Promise<{ feature_id: string; limit_value: number | null; description: string }[]> {
    const qb = this.trx ? this.trx('plan_features') : db('plan_features');
    return (await qb
      .join('feature_flags', 'plan_features.feature_id', 'feature_flags.id')
      .where({
        'plan_features.plan_id': planId,
        'feature_flags.type': 'limit',
        'plan_features.is_enabled': true,
      })
      .select(
        'plan_features.feature_id as feature_id',
        'plan_features.limit_value as limit_value',
        'feature_flags.description as description'
      )) as { feature_id: string; limit_value: number | null; description: string }[];
  }
}
