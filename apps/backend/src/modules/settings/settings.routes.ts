import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import { updateSettingsSchema } from './settings.validator';
import * as controller from './settings.controller';

const router = Router();

router.use(requireAuth);

// Any authenticated user may read tenant settings (e.g. invoice prefix at billing).
router.get('/', controller.getSettings);

// Only admins may change configuration.
router.patch('/', requireRole(['admin']), validate(updateSettingsSchema), controller.updateSettings);

export default router;
