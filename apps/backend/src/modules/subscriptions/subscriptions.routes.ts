import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import { changePlanSchema } from './subscriptions.validator';
import * as controller from './subscriptions.controller';

const router = Router();

router.use(requireAuth);

router.get('/', controller.getSubscription);

// Plan upgrade / downgrade — admin only.
router.post('/change-plan', requireRole(['admin']), validate(changePlanSchema), controller.changePlan);

export default router;
