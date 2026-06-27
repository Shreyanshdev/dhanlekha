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
    // better-sqlite3 is synchronous and supports a single writer. Pinning the
    // pool to one connection (the recommended setup) eliminates intra-process
    // "database is locked" (SQLITE_BUSY) errors; WAL + busy_timeout keep
    // concurrent readers/processes from erroring under load.
    pool: {
      min: 1,
      max: 1,
      afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
        try {
          conn.pragma('journal_mode = WAL');
          conn.pragma('busy_timeout = 5000');
          done(null, conn);
        } catch (err) {
          done(err as Error, conn);
        }
      },
    },
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
