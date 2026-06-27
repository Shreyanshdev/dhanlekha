import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * Rate limiting middleware — protects against brute-force and DDoS.
 *
 * Three tiers:
 *   1. Global   — 200 req/min per IP (general abuse prevention)
 *   2. Auth     — 10 req/min per IP (login brute-force prevention)
 *   3. Heavy    — 30 req/min per IP (invoice creation, bulk operations)
 */

// Standard JSON error response matching our API contract
const standardHandler = (_req: Request, res: Response): void => {
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  });
};

// Disable rate limiting under the automated test runner so suites that issue
// many requests from a single loopback IP are not throttled.
const skipInTest = () => process.env.NODE_ENV === 'test';

/** Global rate limiter — applied to all routes */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute window
  max: 200,             // 200 requests per minute per IP
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,  // Disable `X-RateLimit-*` headers
  handler: standardHandler,
  skip: skipInTest,
});

/** Auth rate limiter — stricter for login/register to prevent brute-force */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute window
  max: 10,              // 10 attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
  skipSuccessfulRequests: true, // Only count failed attempts
  skip: skipInTest,
});

/** Heavy operation limiter — invoices, purchases, bulk writes */
export const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
  skip: skipInTest,
});
