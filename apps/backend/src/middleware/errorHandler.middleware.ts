import { AppError } from '../utils/errors';

/**
 * Global error handler middleware.
 * Catches all errors thrown in controllers/services and returns
 * a standardised JSON response. Internal details are never exposed.
 */
function errorHandler(err: any, req: any, res: any, _next: any) {
  // Default to 500 if not a known AppError
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // Build response
  const response: any = {
    success: false,
    error: {
      code,
      message: statusCode === 500 ? 'Internal server error' : err.message,
    },
  };

  // Include field info for validation errors
  if ((err as any).field) {
    response.error.field = (err as any).field;
  }

  // Log full error for 500s (never expose to client)
  if (statusCode === 500) {
    console.error('[ERROR]', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Log non-500 errors at info level
    console.warn(`[${statusCode}] ${req.method} ${req.originalUrl} — ${err.message}`);
  }

  return res.status(statusCode).json(response);
}

export default errorHandler;
