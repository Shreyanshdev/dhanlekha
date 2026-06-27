import { BaseRepository } from './base.repo';
import type { ChartOfAccount } from '@dhanlekha/shared';

export class AccountRepository extends BaseRepository<ChartOfAccount> {
  constructor(tenantId: string, trx?: any) {
    super(tenantId, 'chart_of_accounts', trx);
  }

  async findByCode(code: string): Promise<ChartOfAccount | undefined> {
    return await this.getQuery().where({ account_code: code }).first();
  }

  /** All active accounts ordered by code (used to build the COA tree). */
  async listAll(): Promise<ChartOfAccount[]> {
    return await this.getQuery().orderBy('account_code', 'asc');
  }
}
