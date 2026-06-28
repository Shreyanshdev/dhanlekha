import { FinancialYearRepository } from '../../repositories/financial-year.repo';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import type { ReportPeriod } from '../../accounting/reports.service';
import type { ReportQuery } from './reports.validator';

export async function resolveReportPeriod(
  tenantId: string,
  query: ReportQuery
): Promise<ReportPeriod> {
  if (query.financial_year_id) {
    const fyRepo = new FinancialYearRepository(tenantId);
    const fy = await fyRepo.findById(query.financial_year_id);
    if (!fy) throw new NotFoundError('Financial year');

    return {
      from: query.from ?? fy.start_date,
      to: query.to ?? fy.end_date,
      financial_year_id: fy.id,
    };
  }

  if (!query.from || !query.to) {
    throw new BadRequestError('from and to are required when financial_year_id is omitted');
  }

  if (query.from > query.to) {
    throw new BadRequestError('from must be on or before to');
  }

  return { from: query.from, to: query.to };
}

export async function resolveAsOfDate(
  tenantId: string,
  query: ReportQuery
): Promise<{ asOf: string; financialYearId?: string }> {
  if (query.as_of) {
    return { asOf: query.as_of, financialYearId: query.financial_year_id };
  }

  const period = await resolveReportPeriod(tenantId, {
    ...query,
    from: query.from,
    to: query.to,
  });

  return { asOf: period.to, financialYearId: period.financial_year_id };
}
