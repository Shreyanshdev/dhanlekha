import { Knex } from 'knex';
import db from '../config/database';

export interface AuditLogRecord {
  id: string;
  tenant_id: string;
  user_id: string | null;
  branch_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  method: string;
  path: string;
  status_code: number;
  ip_address: string | null;
  metadata: string | null;
}

/**
 * AuditLogRepository — append-only writer for the `audit_logs` table.
 *
 * Audit rows are infrastructure records (not soft-deletable, written by
 * middleware), so this repository does not extend BaseRepository. The caller
 * always provides an explicit tenant_id.
 */
export class AuditLogRepository {
  private trx?: Knex.Transaction;

  constructor(trx?: Knex.Transaction) {
    this.trx = trx;
  }

  private query() {
    return this.trx ? this.trx('audit_logs') : db('audit_logs');
  }

  async record(entry: AuditLogRecord): Promise<void> {
    await this.query().insert(entry);
  }

  async listForTenant(
    tenantId: string,
    page = 1,
    limit = 50
  ): Promise<{ items: AuditLogRecord[]; total: number }> {
    const base = db('audit_logs').where({ tenant_id: tenantId });
    const totalRow = await base.clone().count('id as count').first();
    const items = await base
      .clone()
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit);
    return { items: items as AuditLogRecord[], total: Number(totalRow?.count ?? 0) };
  }
}
