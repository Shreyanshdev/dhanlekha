import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createOfferSchema = z.object({
  branch_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Offer name is required').max(200),
  offer_type: z.enum(['flat', 'percentage', 'bogo', 'bundle']),
  discount_value: z.number().min(0, 'Discount value must be >= 0'),
  applies_to: z.enum(['product', 'category', 'invoice', 'customer']),
  applies_to_id: z.string().uuid().optional().nullable(),
  applies_to_category: z.string().max(100).optional().nullable(),
  min_purchase_amount: z.number().min(0).default(0),
  max_uses: z.number().int().positive().optional().nullable(),
  buy_quantity: z.number().int().positive().optional().nullable(),
  get_quantity: z.number().int().positive().optional().nullable(),
  valid_from: z.string().regex(dateRegex, 'valid_from must be YYYY-MM-DD'),
  valid_until: z.string().regex(dateRegex, 'valid_until must be YYYY-MM-DD'),
}).refine(
  (data) => data.valid_from <= data.valid_until,
  { message: 'valid_from must be before or equal to valid_until', path: ['valid_until'] }
).refine(
  (data) => {
    // BOGO offers must specify buy/get quantities
    if (data.offer_type === 'bogo') {
      return data.buy_quantity && data.get_quantity;
    }
    return true;
  },
  { message: 'BOGO offers require buy_quantity and get_quantity', path: ['buy_quantity'] }
).refine(
  (data) => {
    // Product scope requires a target ID
    if (data.applies_to === 'product') return !!data.applies_to_id;
    // Category scope requires a category name
    if (data.applies_to === 'category') return !!data.applies_to_category;
    // Customer scope requires a customer ID
    if (data.applies_to === 'customer') return !!data.applies_to_id;
    return true;
  },
  { message: 'Scope requires a target identifier (applies_to_id or applies_to_category)', path: ['applies_to_id'] }
).refine(
  (data) => {
    // Percentage discount must be <= 100
    if (data.offer_type === 'percentage') return data.discount_value <= 100;
    return true;
  },
  { message: 'Percentage discount cannot exceed 100%', path: ['discount_value'] }
);

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const updateOfferSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  discount_value: z.number().min(0).optional(),
  min_purchase_amount: z.number().min(0).optional(),
  max_uses: z.number().int().positive().optional().nullable(),
  buy_quantity: z.number().int().positive().optional().nullable(),
  get_quantity: z.number().int().positive().optional().nullable(),
  valid_from: z.string().regex(dateRegex).optional(),
  valid_until: z.string().regex(dateRegex).optional(),
  is_active: z.boolean().optional(),
});

export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;

export const offerQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  branch_id: z.string().uuid().optional(),
  offer_type: z.enum(['flat', 'percentage', 'bogo', 'bundle']).optional(),
  applies_to: z.enum(['product', 'category', 'invoice', 'customer']).optional(),
  is_active: z.enum(['true', 'false']).optional(),
  from: z.string().regex(dateRegex).optional(),
  to: z.string().regex(dateRegex).optional(),
});
