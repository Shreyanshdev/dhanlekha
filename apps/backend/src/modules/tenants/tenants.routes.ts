import { Router } from 'express';
import validate from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { updateTenantSchema } from './tenants.validator';
import * as tenantsController from './tenants.controller';

const router = Router();

router.use(requireAuth);

// GET /api/v1/tenants/me
router.get('/me', tenantsController.getMe);

// PATCH /api/v1/tenants/me
router.patch('/me', validate(updateTenantSchema), tenantsController.updateMe);

export default router;
