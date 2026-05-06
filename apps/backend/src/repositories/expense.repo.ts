import { BaseRepository } from './base.repo';
import db from '../config/database';
import type { Expense } from '@dhanlekha/shared';

export class ExpenseRepository extends BaseRepository<Expense> {
  constructor(tenantId: string, trx?: any) {
    super(tenantId, 'expenses', trx);
  }

  async create(expense: Expense): Promise<void> {
    await this.getQuery().insert(expense);
  }

  async listPaged(
    page: number,
    limit: number,
    filters: { branch_id?: string; category?: string; from?: string; to?: string } = {}
  ): Promise<{ items: Expense[]; total: number }> {
    const query = this.getQuery()
      .where(builder => {
        if (filters.branch_id) builder.where('branch_id', filters.branch_id);
        if (filters.category) builder.where('category', filters.category);
        if (filters.from) builder.where('expense_date', '>=', filters.from);
        if (filters.to) builder.where('expense_date', '<=', filters.to);
      })
      .orderBy('expense_date', 'desc')
      .orderBy('created_at', 'desc');

    const totalQuery = query.clone().clearSelect().clearOrder().count('id as count').first() as any;
    const itemsQuery = query.clone().offset((page - 1) * limit).limit(limit);

    const [totalRes, items] = await Promise.all([totalQuery, itemsQuery]);
    return {
      items,
      total: Number(totalRes?.count ?? 0),
    };
  }
}
