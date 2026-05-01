import { Knex } from 'knex';
import db from '../config/database';
import { BaseRepository } from './base.repo';
import { User } from '@dhanlekha/shared';

export class UserRepository extends BaseRepository<User> {
  constructor(tenantId: string) {
    super(tenantId, 'users');
  }

  async findByEmail(email: string, trx?: Knex.Transaction): Promise<User | undefined> {
    return await this.getQuery(trx).where({ email }).first();
  }
}
