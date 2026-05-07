import { AnalyticsRepository } from '../../repositories/analytics.repo';
import db from '../../config/database';
import type { DailyMetric } from '@dhanlekha/shared';
import type { GetDailyAnalyticsInput, GetDashboardInput } from './analytics.validator';

export async function getDailyAnalytics(
  tenantId: string,
  input: GetDailyAnalyticsInput
): Promise<DailyMetric[]> {
  const repo = new AnalyticsRepository(tenantId);
  return await repo.getDailyMetrics(input.start_date, input.end_date, input.branch_id);
}

export async function getDashboardData(
  tenantId: string,
  input: GetDashboardInput
): Promise<any> {
  const repo = new AnalyticsRepository(tenantId);
  return await repo.getDashboardSummary(input.branch_id);
}

export async function getProfitData(
  tenantId: string,
  input: GetDailyAnalyticsInput
): Promise<any> {
  const metrics = await getDailyAnalytics(tenantId, input);
  
  const totals = metrics.reduce((acc, curr) => {
    acc.sales += Number(curr.total_sales);
    acc.purchases += Number(curr.total_purchases);
    acc.expenses += Number(curr.total_expenses);
    acc.profit += Number(curr.total_profit);
    return acc;
  }, { sales: 0, purchases: 0, expenses: 0, profit: 0 });

  return {
    period: {
      start: input.start_date,
      end: input.end_date
    },
    totals,
    breakdown: metrics.map(m => ({
      date: m.date,
      sales: m.total_sales,
      profit: m.total_profit
    }))
  };
}

/**
 * Core aggregation logic used by the background job.
 * Calculates metrics for a specific date and tenant.
 */
export async function aggregateDailyMetrics(
  tenantId: string,
  date: string,
  branchId?: string
): Promise<Partial<DailyMetric>> {
  // Total Sales
  const salesQuery = db('invoices')
    .where({ tenant_id: tenantId, is_deleted: false })
    .whereRaw('date(created_at) = ?', [date])
    .sum('final_amount as total')
    .count('id as count');
  
  if (branchId) salesQuery.where({ branch_id: branchId });
  const salesRes = await salesQuery.first() as any;

  // Total Purchases
  const purchaseQuery = db('purchases')
    .where({ tenant_id: tenantId, is_deleted: false })
    .whereRaw('date(created_at) = ?', [date])
    .sum('total_amount as total');

  if (branchId) purchaseQuery.where({ branch_id: branchId });
  const purchaseRes = await purchaseQuery.first() as any;

  // Total Expenses
  const expenseQuery = db('expenses')
    .where({ tenant_id: tenantId, is_deleted: false })
    .whereRaw('date(created_at) = ?', [date])
    .sum('amount as total');

  if (branchId) expenseQuery.where({ branch_id: branchId });
  const expenseRes = await expenseQuery.first() as any;

  // New Customers
  const customerQuery = db('customers')
    .where({ tenant_id: tenantId, is_deleted: false })
    .whereRaw('date(created_at) = ?', [date])
    .count('id as count');
  
  const customerRes = await customerQuery.first() as any;

  const totalSales = Number(salesRes?.total || 0);
  const totalPurchases = Number(purchaseRes?.total || 0);
  const totalExpenses = Number(expenseRes?.total || 0);

  return {
    date,
    total_sales: totalSales,
    total_purchases: totalPurchases,
    total_expenses: totalExpenses,
    total_profit: totalSales - totalPurchases - totalExpenses,
    invoices_count: Number(salesRes?.count || 0),
    new_customers_count: Number(customerRes?.count || 0)
  };
}
