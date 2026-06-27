import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import { getDailyAnalyticsSchema, getDashboardSchema } from './analytics.validator';
import * as controller from './analytics.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['admin'])); // Only admins can see analytics

/**
 * GET /api/v1/analytics/daily
 */
router.get('/daily', validate(getDailyAnalyticsSchema, 'query'), controller.getDailyAnalytics);

/**
 * GET /api/v1/analytics/dashboard
 */
router.get('/dashboard', validate(getDashboardSchema, 'query'), controller.getDashboardData);

/**
 * GET /api/v1/analytics/profit
 */
router.get('/profit', validate(getDailyAnalyticsSchema, 'query'), controller.getProfitData);

export default router;
