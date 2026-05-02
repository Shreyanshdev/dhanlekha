import type { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';
import { success, created } from '../../utils/response';

/**
 * GET /api/v1/users — list all staff for the tenant (admin only)
 */
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const users = await usersService.listUsers(tenantId);
    return success(res, users);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/users — create a new staff user (admin only)
 */
export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const user = await usersService.createUser(tenantId, req.body);
    return created(res, user);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/users/:id — update a user (admin only)
 */
export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.params.id;
    const user = await usersService.updateUser(tenantId, userId, req.body);
    return success(res, user);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/users/:id — soft-delete a user (admin only)
 */
export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.params.id;
    await usersService.deleteUser(tenantId, userId);
    return success(res, { message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
}
