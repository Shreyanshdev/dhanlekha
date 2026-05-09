import type { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Global error handler middleware.
 * Catches all errors thrown in controllers/services and returns
 * a standardised JSON response. Internal details are never exposed.
 */
function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // Extract properties safely from unknown error
  const error = err as Record<string, unknown>;
  const statusCode = (typeof error.statusCode === 'number' ? error.statusCode : 500) as number;
  const code = (typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR') as string;
  const message = error.message as string || 'Internal server error';

  // Build response — never expose stack traces or internal details
  const response: Record<string, unknown> = {
    success: false,
    error: {
      code,
      message: statusCode === 500 ? 'Internal server error' : message,
    },
  };

  // Include field info for validation errors
  if (typeof error.field === 'string') {
    (response.error as Record<string, unknown>).field = error.field;
  }

  // Structured logging — 500s get full context, others get a one-liner
  if (statusCode === 500) {
    logger.error({
      err: error,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    }, `Unhandled error: ${message}`);
  } else {
    logger.warn({ status: statusCode, url: req.originalUrl }, `${code}: ${message}`);
  }

  res.status(statusCode).json(response);
}

export default errorHandler;
