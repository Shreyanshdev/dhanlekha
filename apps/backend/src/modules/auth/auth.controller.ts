import type { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { created, success } from '../../utils/response';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.registerTenant(req.body);
    return created(res, result);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    return success(res, result);
  } catch (error) {
    next(error);
  }
}
