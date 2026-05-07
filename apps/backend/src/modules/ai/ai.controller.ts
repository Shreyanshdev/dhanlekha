import { Request, Response, NextFunction } from 'express';
import * as aiService from './ai.service';
import { success } from '../../utils/response';

// POST /api/v1/ai/parse-product
export async function parseProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await aiService.parseProduct(req.user!.tenantId, req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/ai/parse-voice
export async function parseVoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await aiService.parseVoice(req.user!.tenantId, req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/ai/suggest-products
export async function suggestProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await aiService.suggestProducts(req.user!.tenantId, req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/ai/demand/:productId
export async function predictDemand(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await aiService.predictDemand(req.user!.tenantId, req.params.productId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/ai/enrich-product
export async function enrichProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await aiService.enrichProduct(req.user!.tenantId, req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/ai/suggestions/:productId
export async function getProductAiData(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await aiService.getProductAiData(req.user!.tenantId, req.params.productId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}
