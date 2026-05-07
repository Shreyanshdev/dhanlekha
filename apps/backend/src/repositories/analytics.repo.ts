import { Knex } from 'knex';
import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import type { DailyMetric } from '@dhanlekha/shared';

export class AnalyticsRepository {
  private tenantId: string;
  private trx?: Knex.Transaction;

  constructor(tenantId: string, trx?: Knex.Transaction) {
    this.tenantId = tenantId;
    this.trx = trx;
  }

  private getQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx('daily_metrics') : db('daily_metrics');
    return qb.where({ tenant_id: this.tenantId });
  }

  async getDailyMetrics(startDate: string, endDate: string, branchId?: string): Promise<DailyMetric[]> {
    const query = this.getQuery()
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc');

    if (branchId) {
      query.where({ branch_id: branchId });
    } else {
      query.whereNull('branch_id'); // Global tenant metrics
    }

    return await query;
  }

  async upsertDailyMetric(data: Partial<DailyMetric>): Promise<void> {
    const query = this.trx ? this.trx('daily_metrics') : db('daily_metrics');
    
    const existing = await query
      .where({
        tenant_id: this.tenantId,
        branch_id: data.branch_id || null,
        date: data.date
      })
      .first();

    if (existing) {
      await query
        .where({ id: existing.id })
        .update({
          ...data,
          updated_at: new Date().toISOString()
        } as any);
    } else {
      await query.insert({
        ...data,
        id: uuidv4(),
        tenant_id: this.tenantId,
        branch_id: data.branch_id || null,
        created_at: new Date().toISOString()
      });
    }
  }

  async getDashboardSummary(branchId?: string): Promise<any> {
    const query = this.getQuery();
    if (branchId) {
      query.where({ branch_id: branchId });
    } else {
      query.whereNull('branch_id');
    }

    const metrics = await query.orderBy('date', 'desc').limit(30);
    
    const summary = {
      total_sales: 0,
      total_profit: 0,
      total_expenses: 0,
      invoices_count: 0,
      recent_activity: metrics
    };

    metrics.forEach(m => {
      summary.total_sales += Number(m.total_sales);
      summary.total_profit += Number(m.total_profit);
      summary.total_expenses += Number(m.total_expenses);
      summary.invoices_count += Number(m.invoices_count);
    });

    return summary;
  }
}
