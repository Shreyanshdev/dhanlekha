import type { Request, Response, NextFunction } from 'express';
import * as settingsService from './settings.service';
import { success } from '../../utils/response';

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const settings = await settingsService.getSettings(tenantId);
    return success(res, settings);
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId;
    const settings = await settingsService.updateSettings(tenantId, req.body);
    return success(res, settings);
  } catch (error) {
    next(error);
  }
}
