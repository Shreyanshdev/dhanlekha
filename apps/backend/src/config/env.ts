import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const env = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,

  // SQLite (local/offline)
  databaseClient: process.env.DATABASE_CLIENT || 'sqlite3',
  sqlitePath: process.env.SQLITE_PATH || path.resolve(__dirname, '../../data/dhanlekha.sqlite'),

  // PostgreSQL (cloud)
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    database: process.env.POSTGRES_DB || 'dhanlekha',
    user: process.env.POSTGRES_USER || 'dhanlekha',
    password: process.env.POSTGRES_PASSWORD || 'dhanlekha_secret',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};

export default env;
