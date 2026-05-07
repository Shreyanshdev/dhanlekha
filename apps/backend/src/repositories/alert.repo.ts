import { Knex } from 'knex';
import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import type { Alert } from '@dhanlekha/shared';

export class AlertRepository {
  private tenantId: string;
  private trx?: Knex.Transaction;

  constructor(tenantId: string, trx?: Knex.Transaction) {
    this.tenantId = tenantId;
    this.trx = trx;
  }

  private getQuery(): Knex.QueryBuilder {
    const qb = this.trx ? this.trx('alerts') : db('alerts');
    return qb.where({ tenant_id: this.tenantId });
  }

  private getInsertQuery(): Knex.QueryBuilder {
    return this.trx ? this.trx('alerts') : db('alerts');
  }

  async findById(id: string): Promise<Alert | undefined> {
    return await this.getQuery().where({ id }).first();
  }

  async create(data: Partial<Alert>): Promise<Alert> {
    const [id] = await this.getInsertQuery().insert({
      ...data,
      id: data.id || uuidv4(),
      tenant_id: this.tenantId,
    }).returning('id');
    
    // Fallback to select if returning is not fully supported in SQLite (though knex does best effort)
    const createdId = typeof id === 'object' ? (id as any).id : id;
    
    // In standard sqlite3 without returning, we might need a different approach,
    // but assuming standard UUID insert:
    const alertId = data.id || createdId;
    return (await this.findById(alertId)) as Alert;
  }

  async createBatch(alerts: Partial<Alert>[]): Promise<void> {
    if (alerts.length === 0) return;
    
    const withTenant = alerts.map(a => ({
      ...a,
      id: a.id || uuidv4(),
      tenant_id: this.tenantId
    }));
    
    const CHUNK_SIZE = 100;
    for (let i = 0; i < withTenant.length; i += CHUNK_SIZE) {
      const chunk = withTenant.slice(i, i + CHUNK_SIZE);
      await this.getInsertQuery().insert(chunk);
    }
  }

  async markAsRead(id: string): Promise<number> {
    return await this.getQuery().where({ id }).update({ is_read: true });
  }

  async listPaged(
    page: number,
    limit: number,
    filters: { branch_id?: string; is_read?: boolean; alert_type?: string } = {}
  ): Promise<{ items: Alert[]; total: number }> {
    const query = this.getQuery();

    if (filters.branch_id) query.where({ branch_id: filters.branch_id });
    if (filters.is_read !== undefined) query.where({ is_read: filters.is_read });
    if (filters.alert_type) query.where({ alert_type: filters.alert_type });

    query.orderBy('created_at', 'desc');

    const totalQuery = query.clone().clearSelect().clearOrder().count('id as count').first() as any;
    const itemsQuery = query.clone().offset((page - 1) * limit).limit(limit);

    const [totalRes, items] = await Promise.all([totalQuery, itemsQuery]);

    return {
      items,
      total: Number(totalRes?.count || 0),
    };
  }
}
