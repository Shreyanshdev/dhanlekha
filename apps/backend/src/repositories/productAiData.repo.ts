import { Knex } from 'knex';
import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface ProductAiData {
  id: string;
  product_id: string;
  normalized_name: string;
  predicted_category: string | null;
  tags: string[] | null;
  price_suggestion: number | null;
  confidence_score: number | null;
  last_used_at: string | null;
  updated_at: string;
}

export class ProductAiDataRepository {
  private trx?: Knex.Transaction;

  constructor(trx?: Knex.Transaction) {
    this.trx = trx;
  }

  private getQuery(): Knex.QueryBuilder {
    return this.trx ? this.trx('product_ai_data') : db('product_ai_data');
  }

  async findByProductId(productId: string): Promise<ProductAiData | undefined> {
    const row = await this.getQuery().where({ product_id: productId }).first();
    if (row && typeof row.tags === 'string') {
      row.tags = JSON.parse(row.tags);
    }
    return row;
  }

  async upsert(productId: string, data: Partial<ProductAiData>): Promise<void> {
    const existing = await this.getQuery().where({ product_id: productId }).first();
    const now = new Date().toISOString();

    const tagsValue = data.tags ? JSON.stringify(data.tags) : null;

    if (existing) {
      await this.getQuery()
        .where({ id: existing.id })
        .update({
          normalized_name: data.normalized_name,
          predicted_category: data.predicted_category || null,
          tags: tagsValue,
          price_suggestion: data.price_suggestion || null,
          confidence_score: data.confidence_score || null,
          last_used_at: now,
          updated_at: now,
        });
    } else {
      await this.getQuery().insert({
        id: uuidv4(),
        product_id: productId,
        normalized_name: data.normalized_name || '',
        predicted_category: data.predicted_category || null,
        tags: tagsValue,
        price_suggestion: data.price_suggestion || null,
        confidence_score: data.confidence_score || null,
        last_used_at: now,
        updated_at: now,
      });
    }
  }

  async touchLastUsed(productId: string): Promise<void> {
    await this.getQuery()
      .where({ product_id: productId })
      .update({ last_used_at: new Date().toISOString() });
  }

  async findStale(olderThanDays: number = 7): Promise<ProductAiData[]> {
    const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    return await this.getQuery().where('updated_at', '<', cutoff);
  }
}
