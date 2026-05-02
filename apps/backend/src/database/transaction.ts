import { Knex } from 'knex';
import db from '../config/database';

/**
 * Execute a callback within a Knex transaction.
 * Always use this helper for financial operations (billing, inventory, payments).
 */
export async function withTransaction<T>(
  callback: (trx: Knex.Transaction) => Promise<T>
): Promise<T> {
  return await db.transaction(callback);
}
