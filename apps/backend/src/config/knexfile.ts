import path from 'path';
import env from './env';

const config: any = {
  // ── Development: SQLite (offline-first) ──
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: env.sqlitePath,
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, '../database/migrations'),
    },
    seeds: {
      directory: path.resolve(__dirname, '../database/seeds'),
    },
  },

  // ── Production: PostgreSQL (cloud) ──
  production: {
    client: 'pg',
    connection: {
      host: env.postgres.host,
      port: env.postgres.port,
      database: env.postgres.database,
      user: env.postgres.user,
      password: env.postgres.password,
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: path.resolve(__dirname, '../database/migrations'),
    },
    seeds: {
      directory: path.resolve(__dirname, '../database/seeds'),
    },
  },
};

export default config;
