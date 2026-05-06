import { v4 as uuidv4 } from 'uuid';
import { ExpenseRepository } from '../../repositories/expense.repo';
import { NotFoundError } from '../../utils/errors';
import type { Expense } from '@dhanlekha/shared';
import type { CreateExpenseInput } from './expenses.validator';

// Expense service logic

export async function createExpense(
  tenantId: string,
  userId: string,
  data: CreateExpenseInput
): Promise<Expense> {
  const expenseRepo = new ExpenseRepository(tenantId);
  
  const expense: Expense = {
    id: uuidv4(),
    tenant_id: tenantId,
    branch_id: data.branch_id,
    category: data.category,
    amount: data.amount,
    note: data.note ?? null,
    payment_mode: data.payment_mode,
    expense_date: data.expense_date ?? new Date().toISOString().split('T')[0],
    recorded_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_deleted: false,
  };

  await expenseRepo.create(expense);
  return expense;
}

export async function listExpenses(tenantId: string, page: number, limit: number, filters: any) {
  const expenseRepo = new ExpenseRepository(tenantId);
  return await expenseRepo.listPaged(page, limit, filters);
}

export async function deleteExpense(tenantId: string, id: string): Promise<void> {
  const expenseRepo = new ExpenseRepository(tenantId);
  const expense = await expenseRepo.findById(id);
  if (!expense) throw new NotFoundError('Expense');
  
  await expenseRepo.softDelete(id);
}
