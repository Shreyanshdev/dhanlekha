import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import { listAlertsSchema } from './alerts.validator';
import * as controller from './alerts.controller';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/alerts
 * List alerts (unread first usually, or sorted by created_at desc)
 */
router.get('/', validate(listAlertsSchema, 'query'), controller.listAlerts);

/**
 * PATCH /api/v1/alerts/:id/read
 * Mark alert as read
 */
router.patch('/:id/read', controller.markAsRead);

export default router;
