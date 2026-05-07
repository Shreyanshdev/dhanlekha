import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import { AuthenticationError } from '../utils/errors';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  branchId: string | null;
  role: 'admin' | 'cashier';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Authentication: Verifies the JWT token and identifies the user
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
    req.user = payload;
    next();
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token');
  }
}

// Authorization: Checks if the authenticated user has the required permissions
export function requireRole(roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new AuthenticationError(`Access denied: requires one of the roles [${roles.join(', ')}]`);
    }

    next();
  };
}
