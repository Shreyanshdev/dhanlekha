import { v4 as uuidv4 } from 'uuid';
import { OfferRepository } from '../../repositories/offer.repo';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import type { Offer } from '@dhanlekha/shared';
import type { CreateOfferInput, UpdateOfferInput } from './offers.validator';

/**
 * Create a new offer/promotion.
 */
export async function createOffer(
  tenantId: string,
  data: CreateOfferInput
): Promise<Offer> {
  const offerRepo = new OfferRepository(tenantId);

  const offer: Offer = {
    id: uuidv4(),
    tenant_id: tenantId,
    branch_id: data.branch_id ?? null,
    name: data.name,
    offer_type: data.offer_type,
    discount_value: data.discount_value,
    applies_to: data.applies_to,
    applies_to_id: data.applies_to_id ?? null,
    applies_to_category: data.applies_to_category ?? null,
    min_purchase_amount: data.min_purchase_amount,
    max_uses: data.max_uses ?? null,
    used_count: 0,
    buy_quantity: data.buy_quantity ?? null,
    get_quantity: data.get_quantity ?? null,
    valid_from: data.valid_from,
    valid_until: data.valid_until,
    is_active: true,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await offerRepo.create(offer);
  return offer;
}

/**
 * Get offer by ID.
 */
export async function getOfferById(tenantId: string, id: string): Promise<Offer> {
  const offerRepo = new OfferRepository(tenantId);
  const offer = await offerRepo.findById(id);
  if (!offer) throw new NotFoundError('Offer');
  return offer;
}

/**
 * Update offer fields (name, value, validity, active status).
 * Cannot change offer_type or applies_to after creation.
 */
export async function updateOffer(
  tenantId: string,
  id: string,
  data: UpdateOfferInput
): Promise<Offer> {
  const offerRepo = new OfferRepository(tenantId);
  const existing = await offerRepo.findById(id);
  if (!existing) throw new NotFoundError('Offer');

  // Validate date consistency if both are being updated
  const newFrom = data.valid_from ?? existing.valid_from;
  const newUntil = data.valid_until ?? existing.valid_until;
  if (newFrom > newUntil) {
    throw new BadRequestError('valid_from must be before or equal to valid_until');
  }

  await offerRepo.update(id, {
    ...data,
    updated_at: new Date().toISOString(),
  });

  return (await offerRepo.findById(id))!;
}

/**
 * Soft-delete an offer.
 */
export async function deleteOffer(tenantId: string, id: string): Promise<void> {
  const offerRepo = new OfferRepository(tenantId);
  const offer = await offerRepo.findById(id);
  if (!offer) throw new NotFoundError('Offer');
  await offerRepo.softDelete(id);
}

/**
 * List offers with pagination and filters.
 */
export async function listOffers(
  tenantId: string,
  page: number,
  limit: number,
  filters: any
): Promise<{ items: Offer[]; total: number }> {
  const offerRepo = new OfferRepository(tenantId);
  return await offerRepo.listPaged(page, limit, filters);
}

/**
 * ─── BILLING ENGINE INTEGRATION ──────────────────────────────
 * 
 * Find the best applicable offer for a given product line item.
 * Called by the invoice service during invoice creation.
 * 
 * Selection logic:
 *   1. Find all active offers matching this product/category/invoice scope
 *   2. Filter by min_purchase_amount
 *   3. Select the offer yielding the highest discount
 *   4. Check usage capacity (max_uses vs used_count)
 *   5. Return the best match (or null if no applicable offer)
 */
export async function findBestOfferForItem(
  tenantId: string,
  branchId: string,
  productId: string,
  category: string | null,
  unitPrice: number,
  quantity: number,
  invoiceSubtotal: number
): Promise<{ offer: Offer; discountAmount: number } | null> {
  const offerRepo = new OfferRepository(tenantId);
  const today = new Date().toISOString().split('T')[0];

  const candidates = await offerRepo.findOffersForProduct(branchId, productId, category, today);

  let bestMatch: { offer: Offer; discountAmount: number } | null = null;

  for (const offer of candidates) {
    // Skip if minimum purchase not met (for invoice-level offers)
    if (offer.min_purchase_amount > 0 && invoiceSubtotal < offer.min_purchase_amount) {
      continue;
    }

    let discountAmount = 0;
    const lineTotal = unitPrice * quantity;

    switch (offer.offer_type) {
      case 'flat':
        // Fixed amount off the line total
        discountAmount = Math.min(offer.discount_value, lineTotal);
        break;

      case 'percentage':
        // Percentage off the line total
        discountAmount = (lineTotal * offer.discount_value) / 100;
        break;

      case 'bogo':
        // Buy N, Get M free — discount = price of free items
        if (offer.buy_quantity && offer.get_quantity) {
          const sets = Math.floor(quantity / (offer.buy_quantity + offer.get_quantity));
          const freeItems = sets * offer.get_quantity;
          discountAmount = freeItems * unitPrice;
        }
        break;

      case 'bundle':
        // Fixed price for a bundle — discount = (normal total - bundle price)
        discountAmount = Math.max(0, lineTotal - offer.discount_value);
        break;
    }

    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;

    if (discountAmount > 0 && (!bestMatch || discountAmount > bestMatch.discountAmount)) {
      bestMatch = { offer, discountAmount };
    }
  }

  return bestMatch;
}
