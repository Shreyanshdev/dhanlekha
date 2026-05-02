import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';

/**
 * Role-based authorization middleware factory.
 * Must be used AFTER requireAuth (which sets req.user).
 *
 * Usage:
 *   router.get('/admin-only', requireAuth, authorize('admin'), handler);
 *   router.get('/any-role', requireAuth, authorize('admin', 'cashier'), handler);
 */
export function authorize(...allowedRoles: Array<'admin' | 'cashier'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return next(new ForbiddenError('Authentication required before authorization'));
    }

    if (!allowedRoles.includes(user.role)) {
      return next(
        new ForbiddenError(`Role '${user.role}' is not authorized. Required: ${allowedRoles.join(' or ')}`)
      );
    }

    next();
  };
}
