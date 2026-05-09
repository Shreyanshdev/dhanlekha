import type { Request, Response, NextFunction } from 'express';

/**
 * Input Sanitisation Middleware — strips dangerous patterns from request body.
 *
 * Protects against:
 *   - XSS via HTML/script injection in string fields
 *   - NoSQL injection via $-prefixed operators
 *   - Prototype pollution via __proto__ keys
 *
 * Note: SQL injection is already handled by Knex parameterised queries.
 * This middleware adds defense-in-depth for the HTTP layer.
 */
export function sanitiseInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitiseObject(req.body);
  }
  next();
}

function sanitiseObject(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Block prototype pollution attempts
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    // Block NoSQL $-operator injection
    if (key.startsWith('$')) {
      continue;
    }

    if (typeof value === 'string') {
      clean[key] = sanitiseString(value);
    } else if (Array.isArray(value)) {
      clean[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitiseString(item)
          : typeof item === 'object' && item !== null
            ? sanitiseObject(item as Record<string, unknown>)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitiseObject(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

function sanitiseString(input: string): string {
  return input
    .replace(/</g, '&lt;')      // Prevent HTML tag injection
    .replace(/>/g, '&gt;')
    .replace(/javascript:/gi, '') // Prevent JS protocol
    .replace(/on\w+\s*=/gi, '')  // Prevent inline event handlers (onclick=, etc.)
    .trim();
}
