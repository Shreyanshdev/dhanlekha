import { z, ZodSchema } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

/**
 * Zod validation middleware factory.
 * Validates req.body against a Zod schema before the request reaches the controller.
 *
 * @param {ZodSchema} schema — Zod schema to validate against
 * @param {'body'|'query'|'params'} source — which part of the request to validate
 * @returns {Function} Express middleware
 */
export default function validate(schema: ZodSchema<any>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsedData = schema.parse(req[source]);
      // Replace request data with parsed/sanitized data
      req[source] = parsedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        const errorMessage = firstError.message;
        const field = firstError.path.join('.');
        next(new ValidationError(errorMessage, field));
      } else {
        next(error);
      }
    }
  };
}
