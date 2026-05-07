import aiClient, { circuitBreaker } from '../../config/aiClient';
import { ProductAiDataRepository } from '../../repositories/productAiData.repo';
import { ProductRepository } from '../../repositories/product.repo';
import db from '../../config/database';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import type { ParseProductInput, ParseVoiceInput, SuggestProductsInput, EnrichProductInput } from './ai.validator';

// ─── Plan Gate Check ───

async function checkAiFeature(tenantId: string, featureKey: string): Promise<void> {
  // Check tenant_overrides first (takes priority over plan_features)
  const override = await db('tenant_overrides')
    .where({ tenant_id: tenantId, feature_id: featureKey })
    .first();

  if (override) {
    if (override.is_enabled) {
      return; // Override grants access
    } else {
      throw new ForbiddenError(`AI feature '${featureKey}' is disabled for your account.`);
    }
  }

  // Check plan_features
  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) throw new NotFoundError('Tenant');

  const planFeature = await db('plan_features')
    .where({ plan_id: tenant.plan_id, feature_id: featureKey })
    .first();

  if (!planFeature || !planFeature.is_enabled) {
    throw new ForbiddenError(
      `AI feature '${featureKey}' is not available on your plan. Please upgrade.`
    );
  }
}

// ─── Fallback Helpers ───

function fallbackParse(text: string) {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
  const tags = normalized.split(/\s+/).filter(t => t.length > 1);
  return {
    normalized_name: normalized,
    predicted_category: null,
    tags,
    price_suggestion: null,
    confidence_score: 0,
    source: 'fallback' as const,
  };
}

// ─── 1. Parse Product (AI auto-entry) ───

export async function parseProduct(tenantId: string, input: ParseProductInput) {
  await checkAiFeature(tenantId, 'ai_product_entry');

  // Circuit breaker check
  if (circuitBreaker.isOpen()) {
    console.warn('[AI] Circuit breaker OPEN — returning fallback');
    return fallbackParse(input.text);
  }

  try {
    const response = await aiClient.post('/ai/parse-product', { text: input.text });
    circuitBreaker.recordSuccess();

    return { ...response.data, source: 'ai' };
  } catch (error) {
    circuitBreaker.recordFailure();
    console.warn('[AI] parse-product failed, using fallback:', (error as Error).message);
    return fallbackParse(input.text);
  }
}

// ─── 2. Voice Billing ───

export async function parseVoice(tenantId: string, input: ParseVoiceInput) {
  await checkAiFeature(tenantId, 'ai_voice_billing');

  // Fetch product catalog for matching
  const productRepo = new ProductRepository(tenantId);
  const products = await productRepo.findAll();
  const catalog = products.map((p: any) => ({ name: p.name, barcode: p.barcode }));

  if (circuitBreaker.isOpen()) {
    console.warn('[AI] Circuit breaker OPEN — returning empty voice parse');
    return { items: [], source: 'fallback' };
  }

  try {
    const response = await aiClient.post('/ai/parse-voice', {
      transcript: input.transcript,
      product_catalog: catalog,
    });
    circuitBreaker.recordSuccess();

    return { ...response.data, source: 'ai' };
  } catch (error) {
    circuitBreaker.recordFailure();
    console.warn('[AI] parse-voice failed:', (error as Error).message);
    return { items: [], source: 'fallback' };
  }
}

// ─── 3. Smart Suggestions ───

export async function suggestProducts(tenantId: string, input: SuggestProductsInput) {
  await checkAiFeature(tenantId, 'ai_smart_suggestions');

  // Fetch product catalog for matching
  const productRepo = new ProductRepository(tenantId);
  const products = await productRepo.findAll();
  const catalog = products.map((p: any) => ({ id: p.id, name: p.name, category: p.category }));

  if (circuitBreaker.isOpen()) {
    // Local fallback: simple substring matching
    const query = input.query.toLowerCase();
    const matches = catalog
      .filter(p => p.name.toLowerCase().includes(query))
      .slice(0, 5)
      .map(p => ({ product_id: p.id, name: p.name, score: 0.5 }));
    return { suggestions: matches, source: 'fallback' };
  }

  try {
    const response = await aiClient.post('/ai/suggest-products', {
      query: input.query,
      catalog,
    });
    circuitBreaker.recordSuccess();

    return { ...response.data, source: 'ai' };
  } catch (error) {
    circuitBreaker.recordFailure();
    console.warn('[AI] suggest-products failed, using local search:', (error as Error).message);

    const query = input.query.toLowerCase();
    const matches = catalog
      .filter(p => p.name.toLowerCase().includes(query))
      .slice(0, 5)
      .map(p => ({ product_id: p.id, name: p.name, score: 0.5 }));
    return { suggestions: matches, source: 'fallback' };
  }
}

// ─── 4. Demand Prediction ───

export async function predictDemand(tenantId: string, productId: string) {
  await checkAiFeature(tenantId, 'ai_demand_prediction');

  // Verify product exists
  const productRepo = new ProductRepository(tenantId);
  const product = await productRepo.findById(productId);
  if (!product) throw new NotFoundError('Product');

  // Fetch recent sales history for this product
  const salesHistory = await db('invoice_items')
    .join('invoices', 'invoice_items.invoice_id', 'invoices.id')
    .where({ 'invoices.tenant_id': tenantId, 'invoice_items.product_id': productId })
    .andWhere('invoices.is_deleted', false)
    .select(db.raw('date(invoices.created_at) as date'), db.raw('SUM(invoice_items.quantity) as quantity'))
    .groupByRaw('date(invoices.created_at)')
    .orderBy('date', 'desc')
    .limit(90); // Last 90 days

  if (circuitBreaker.isOpen()) {
    return {
      predicted_demand: null,
      trend: 'unknown',
      confidence_score: 0,
      sales_history: salesHistory,
      source: 'fallback',
    };
  }

  try {
    const response = await aiClient.get(`/ai/predict-demand/${productId}`, {
      params: { sales_history: JSON.stringify(salesHistory) },
    });
    circuitBreaker.recordSuccess();

    return { ...response.data, sales_history: salesHistory, source: 'ai' };
  } catch (error) {
    circuitBreaker.recordFailure();
    console.warn('[AI] predict-demand failed:', (error as Error).message);
    return {
      predicted_demand: null,
      trend: 'unknown',
      confidence_score: 0,
      sales_history: salesHistory,
      source: 'fallback',
    };
  }
}

// ─── 5. Enrich Product (background) ───

export async function enrichProduct(tenantId: string, input: EnrichProductInput) {
  await checkAiFeature(tenantId, 'ai_product_entry');

  const productRepo = new ProductRepository(tenantId);
  const product = await productRepo.findById(input.product_id);
  if (!product) throw new NotFoundError('Product');

  const aiDataRepo = new ProductAiDataRepository();

  if (circuitBreaker.isOpen()) {
    // Store basic fallback data
    const fallback = fallbackParse(product.name);
    await aiDataRepo.upsert(input.product_id, fallback);
    return { ...fallback, product_id: input.product_id };
  }

  try {
    const response = await aiClient.post('/ai/enrich-product', {
      name: product.name,
      category: product.category,
      barcode: product.barcode,
    });
    circuitBreaker.recordSuccess();

    // Cache the enriched data
    await aiDataRepo.upsert(input.product_id, response.data);

    return { ...response.data, product_id: input.product_id, source: 'ai' };
  } catch (error) {
    circuitBreaker.recordFailure();
    console.warn('[AI] enrich-product failed:', (error as Error).message);

    const fallback = fallbackParse(product.name);
    await aiDataRepo.upsert(input.product_id, fallback);
    return { ...fallback, product_id: input.product_id };
  }
}

// ─── 6. Get AI Suggestions for a product (cached data) ───

export async function getProductAiData(tenantId: string, productId: string) {
  const productRepo = new ProductRepository(tenantId);
  const product = await productRepo.findById(productId);
  if (!product) throw new NotFoundError('Product');

  const aiDataRepo = new ProductAiDataRepository();
  const cached = await aiDataRepo.findByProductId(productId);

  if (cached) {
    await aiDataRepo.touchLastUsed(productId);
    return { ...cached, source: 'cache' };
  }

  // No cached data — try enriching now
  return await enrichProduct(tenantId, { product_id: productId });
}
