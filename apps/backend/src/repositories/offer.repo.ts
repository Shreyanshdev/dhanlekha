import { BaseRepository } from './base.repo';
import db from '../config/database';
import type { Offer } from '@dhanlekha/shared';

export class OfferRepository extends BaseRepository<Offer> {
  constructor(tenantId: string, trx?: any) {
    super(tenantId, 'offers', trx);
  }

  /**
   * Find all active offers valid for a given date.
   * Filters: is_active=true, is_deleted=false, valid_from <= date <= valid_until
   * Optionally scoped to a specific branch (or global: branch_id IS NULL).
   */
  async findActiveOffers(branchId: string, date: string): Promise<Offer[]> {
    return await this.getQuery()
      .where('is_active', true)
      .where('valid_from', '<=', date)
      .where('valid_until', '>=', date)
      .where(function () {
        this.whereNull('branch_id')        // Global offers
          .orWhere('branch_id', branchId);  // Branch-specific offers
      })
      .where(function () {
        this.whereNull('max_uses')                          // Unlimited
          .orWhereRaw('"used_count" < "max_uses"');         // Still has capacity
      })
      .orderBy('created_at', 'desc');
  }

  /**
   * Find active offers for a specific product.
   */
  async findOffersForProduct(branchId: string, productId: string, category: string | null, date: string): Promise<Offer[]> {
    const allActive = await this.findActiveOffers(branchId, date);

    return allActive.filter(offer => {
      switch (offer.applies_to) {
        case 'product':
          return offer.applies_to_id === productId;
        case 'category':
          return category && offer.applies_to_category === category;
        case 'invoice':
          return true; // Invoice-level offers are applied separately
        default:
          return false;
      }
    });
  }

  /**
   * Increment the used_count atomically.
   */
  async incrementUsedCount(offerId: string): Promise<void> {
    await this.getQuery()
      .where({ id: offerId })
      .increment('used_count', 1);
  }

  /**
   * Paginated listing with filters.
   */
  async listPaged(
    page: number,
    limit: number,
    filters: {
      branch_id?: string;
      offer_type?: string;
      applies_to?: string;
      is_active?: string;
      from?: string;
      to?: string;
    } = {}
  ): Promise<{ items: Offer[]; total: number }> {
    const query = this.getQuery()
      .where(builder => {
        if (filters.branch_id) builder.where('branch_id', filters.branch_id);
        if (filters.offer_type) builder.where('offer_type', filters.offer_type);
        if (filters.applies_to) builder.where('applies_to', filters.applies_to);
        if (filters.is_active !== undefined) builder.where('is_active', filters.is_active === 'true');
        if (filters.from) builder.where('valid_from', '>=', filters.from);
        if (filters.to) builder.where('valid_until', '<=', filters.to);
      })
      .orderBy('created_at', 'desc');

    const totalQuery = query.clone().clearSelect().clearOrder().count('id as count').first() as any;
    const itemsQuery = query.clone().offset((page - 1) * limit).limit(limit);

    const [totalRes, items] = await Promise.all([totalQuery, itemsQuery]);
    return {
      items,
      total: Number(totalRes?.count ?? 0),
    };
  }
}
