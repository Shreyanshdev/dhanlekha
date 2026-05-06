import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import validate from '../../middleware/validate.middleware';
import { createOfferSchema, updateOfferSchema, offerQuerySchema } from './offers.validator';
import * as controller from './offers.controller';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/offers
 * List offers (paginated, filterable)
 */
router.get('/', validate(offerQuerySchema, 'query'), controller.listOffers);

/**
 * GET /api/v1/offers/:id
 * Get offer detail
 */
router.get('/:id', controller.getOffer);

/**
 * POST /api/v1/offers
 * Create a new offer (Admin only)
 */
router.post('/', authorize('admin'), validate(createOfferSchema), controller.createOffer);

/**
 * PATCH /api/v1/offers/:id
 * Update offer fields (Admin only)
 */
router.patch('/:id', authorize('admin'), validate(updateOfferSchema), controller.updateOffer);

/**
 * DELETE /api/v1/offers/:id
 * Soft-delete an offer (Admin only)
 */
router.delete('/:id', authorize('admin'), controller.deleteOffer);

export default router;
