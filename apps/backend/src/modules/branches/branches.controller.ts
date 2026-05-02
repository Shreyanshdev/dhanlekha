import { Request, Response, NextFunction } from 'express';
import * as branchesService from './branches.service';
import { success, created } from '../../utils/response';

export async function listBranches(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const branches = await branchesService.getBranches(tenantId);
    return success(res, branches);
  } catch (error) {
    next(error);
  }
}

export async function createBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const branch = await branchesService.createBranch(tenantId, req.body);
    return created(res, branch);
  } catch (error) {
    next(error);
  }
}

export async function updateBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const branch = await branchesService.updateBranch(tenantId, id, req.body);
    return success(res, branch);
  } catch (error) {
    next(error);
  }
}

export async function deleteBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    await branchesService.deleteBranch(tenantId, id);
    return success(res, null, 204);
  } catch (error) {
    next(error);
  }
}
