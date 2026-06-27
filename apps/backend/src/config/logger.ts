import pino from 'pino';
import env from './env';

/**
 * Structured Logger (Pino) — replaces console.log across the backend.
 *
 * - Development: pretty-printed, human-readable output
 * - Production: JSON lines for log aggregation (ELK, Datadog, etc.)
 *
 * Usage:
 *   import logger from './config/logger';
 *   logger.info({ tenantId, invoiceId }, 'Invoice created');
 *   logger.error({ err }, 'Payment processing failed');
 */
const logger = pino({
  // Silence logs under the test runner; info in prod; debug in dev.
  level: env.nodeEnv === 'test' ? 'silent' : env.nodeEnv === 'production' ? 'info' : 'debug',

  // In dev, pipe through pino-pretty for human-readable output
  transport: env.nodeEnv !== 'production' && env.nodeEnv !== 'test'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined,

  // Standard fields added to every log line
  base: {
    service: 'dhanlekha-backend',
    env: env.nodeEnv,
  },

  // Redact sensitive fields from ever appearing in logs
  redact: {
    paths: ['req.headers.authorization', 'password', 'password_hash', 'jwt.secret'],
    censor: '[REDACTED]',
  },
});

export default logger;
