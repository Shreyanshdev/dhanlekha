/**
 * Request logging middleware — structured JSON logs via Pino.
 * Logs method, URL, status code, response time, and IP for every request.
 */
import type { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error(logData, `${req.method} ${req.originalUrl} → ${res.statusCode}`);
    } else if (res.statusCode >= 400) {
      logger.warn(logData, `${req.method} ${req.originalUrl} → ${res.statusCode}`);
    } else {
      logger.info(logData, `${req.method} ${req.originalUrl} → ${res.statusCode}`);
    }
  });

  next();
}

export default requestLogger;
