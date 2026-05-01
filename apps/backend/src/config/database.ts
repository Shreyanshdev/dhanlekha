import knex from 'knex';
import knexConfig from './knexfile';
import env from './env';

const environment = env.nodeEnv === 'production' ? 'production' : 'development';
const db = knex(knexConfig[environment]);

export default db;
