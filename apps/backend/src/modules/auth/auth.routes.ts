import { Router } from 'express';
import validate from '../../middleware/validate.middleware';
import { registerSchema } from './auth.validator';
import * as authController from './auth.controller';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', validate(registerSchema), authController.register);

export default router;
