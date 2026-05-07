import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import { parseProductSchema, parseVoiceSchema, suggestProductsSchema, enrichProductSchema } from './ai.validator';
import * as controller from './ai.controller';

const router = Router();

// Authentication required for all AI endpoints
router.use(requireAuth);

/**
 * POST /api/v1/ai/parse-product
 * AI-based product name parsing and auto-entry
 * Plan gate: ai_product_entry (Growth + Enterprise)
 */
router.post('/parse-product', validate(parseProductSchema), controller.parseProduct);

/**
 * POST /api/v1/ai/parse-voice
 * Convert speech transcript to invoice items
 * Plan gate: ai_voice_billing (Enterprise only)
 */
router.post('/parse-voice', validate(parseVoiceSchema), controller.parseVoice);

/**
 * POST /api/v1/ai/suggest-products
 * Smart product suggestions during billing
 * Plan gate: ai_smart_suggestions (Growth + Enterprise)
 */
router.post('/suggest-products', validate(suggestProductsSchema), controller.suggestProducts);

/**
 * GET /api/v1/ai/demand/:productId
 * Demand prediction for a product
 * Plan gate: ai_demand_prediction (Enterprise only)
 */
router.get('/demand/:productId', controller.predictDemand);

/**
 * POST /api/v1/ai/enrich-product
 * Enrich a product with AI metadata (runs in background)
 * Plan gate: ai_product_entry (Growth + Enterprise)
 */
router.post('/enrich-product', validate(enrichProductSchema), controller.enrichProduct);

/**
 * GET /api/v1/ai/suggestions/:productId
 * Get cached AI suggestions for a product
 * No specific plan gate — reads cached data
 */
router.get('/suggestions/:productId', controller.getProductAiData);

export default router;
