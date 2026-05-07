import { z } from 'zod';

// POST /api/v1/ai/parse-product
export const parseProductSchema = z.object({
  text: z.string().min(1, 'Product text is required').max(500),
});
export type ParseProductInput = z.infer<typeof parseProductSchema>;

// POST /api/v1/ai/parse-voice
export const parseVoiceSchema = z.object({
  transcript: z.string().min(1, 'Voice transcript is required').max(2000),
});
export type ParseVoiceInput = z.infer<typeof parseVoiceSchema>;

// POST /api/v1/ai/suggest-products
export const suggestProductsSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(200),
});
export type SuggestProductsInput = z.infer<typeof suggestProductsSchema>;

// POST /api/v1/ai/enrich-product
export const enrichProductSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
});
export type EnrichProductInput = z.infer<typeof enrichProductSchema>;
