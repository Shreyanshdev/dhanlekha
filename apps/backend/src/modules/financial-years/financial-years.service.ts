import { v4 as uuidv4 } from 'uuid';
import {
  FinancialYearRepository,
  OpeningBalanceRepository,
} from '../../repositories/financial-year.repo';
import { withTransaction } from '../../database/transaction';
import { computeClosingOpeningRows } from '../../accounting/reports.service';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import type { FinancialYear } from '@dhanlekha/shared';
import type { CloseFinancialYearInput, CreateFinancialYearInput } from './financial-years.validator';

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function listFinancialYears(tenantId: string): Promise<FinancialYear[]> {
  return await new FinancialYearRepository(tenantId).listAll();
}

export async function createFinancialYear(
  tenantId: string,
  data: CreateFinancialYearInput
): Promise<FinancialYear> {
  const repo = new FinancialYearRepository(tenantId);

  if (await repo.hasOverlap(data.start_date, data.end_date)) {
    throw new BadRequestError('Financial year dates overlap an existing year');
  }

  const id = uuidv4();
  await repo.create({
    id,
    tenant_id: tenantId,
    name: data.name,
    start_date: data.start_date,
    end_date: data.end_date,
    status: 'open',
    is_deleted: false,
  });

  return (await repo.findById(id))!;
}

export async function closeFinancialYear(
  tenantId: string,
  financialYearId: string,
  data: CloseFinancialYearInput
): Promise<{ closed: FinancialYear; next: FinancialYear; opening_accounts: number }> {
  const fyRepo = new FinancialYearRepository(tenantId);
  const fy = await fyRepo.findById(financialYearId);
  if (!fy) throw new NotFoundError('Financial year');
  if (fy.status === 'closed') {
    throw new BadRequestError('Financial year is already closed');
  }

  // Compute outside the write transaction to avoid SQLite lock contention.
  const closingRows = await computeClosingOpeningRows(tenantId, fy.end_date);

  return await withTransaction(async (trx) => {
    const txFyRepo = new FinancialYearRepository(tenantId, trx);
    const obRepo = new OpeningBalanceRepository(tenantId, trx);

    let nextYear: FinancialYear | undefined;

    if (data.next_year) {
      if (data.next_year.start_date <= fy.end_date) {
        throw new BadRequestError('Next year must start after the closing year end_date');
      }
      if (await txFyRepo.hasOverlap(data.next_year.start_date, data.next_year.end_date)) {
        throw new BadRequestError('Next financial year dates overlap an existing year');
      }

      const nextId = uuidv4();
      await txFyRepo.create({
        id: nextId,
        tenant_id: tenantId,
        name: data.next_year.name,
        start_date: data.next_year.start_date,
        end_date: data.next_year.end_date,
        status: 'open',
        is_deleted: false,
      });
      nextYear = (await txFyRepo.findById(nextId))!;
    } else {
      const suggestedStart = addDays(fy.end_date, 1);
      const suggestedEnd = addDays(suggestedStart, 364);
      const existing = (await txFyRepo.listAll()).find(
        (y) => y.status === 'open' && y.start_date >= suggestedStart
      );
      if (existing) {
        nextYear = existing;
      } else {
        const nextId = uuidv4();
        await txFyRepo.create({
          id: nextId,
          tenant_id: tenantId,
          name: `FY after ${fy.name}`,
          start_date: suggestedStart,
          end_date: suggestedEnd,
          status: 'open',
          is_deleted: false,
        });
        nextYear = (await txFyRepo.findById(nextId))!;
      }
    }

    await obRepo.replaceForYear(nextYear.id, closingRows);
    await txFyRepo.markClosed(fy.id);

    const closed = (await txFyRepo.findById(fy.id))!;
    return { closed, next: nextYear, opening_accounts: closingRows.length };
  });
}
