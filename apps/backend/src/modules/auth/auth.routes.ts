import { Router } from 'express';
import validate from '../../middleware/validate.middleware';
import { registerSchema, loginSchema } from './auth.validator';
import * as authController from './auth.controller';

const router = Router();

// POST /api/v1/auth/register — create tenant + admin user
router.post('/register', validate(registerSchema), authController.register);

// POST /api/v1/auth/login — authenticate, return JWT
router.post('/login', validate(loginSchema), authController.login);

export default router;
