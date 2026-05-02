import { Router } from 'express';
import validate from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { createUserSchema, updateUserSchema, userIdParamSchema } from './users.validator';
import * as usersController from './users.controller';

const router = Router();

// All user management routes require authentication
router.use(requireAuth);

// GET /api/v1/users — list staff (admin only)
router.get('/', authorize('admin'), usersController.listUsers);

// POST /api/v1/users — create staff user (admin only)
router.post('/', authorize('admin'), validate(createUserSchema), usersController.createUser);

// PATCH /api/v1/users/:id — update user (admin only)
router.patch(
  '/:id',
  authorize('admin'),
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema),
  usersController.updateUser
);

// DELETE /api/v1/users/:id — soft-delete user (admin only)
router.delete(
  '/:id',
  authorize('admin'),
  validate(userIdParamSchema, 'params'),
  usersController.deleteUser
);

export default router;
