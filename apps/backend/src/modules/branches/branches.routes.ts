import { Router } from 'express';
import * as branchesController from './branches.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import validate from '../../middleware/validate.middleware';
import { createBranchSchema, updateBranchSchema } from './branches.validator';
import { z } from 'zod';

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid(),
});

router.use(requireAuth);

router.get('/', branchesController.listBranches);

router.post(
  '/',
  authorize('admin'),
  validate(createBranchSchema),
  branchesController.createBranch
);

router.patch(
  '/:id',
  authorize('admin'),
  validate(idParamSchema, 'params'),
  validate(updateBranchSchema),
  branchesController.updateBranch
);

router.delete(
  '/:id',
  authorize('admin'),
  validate(idParamSchema, 'params'),
  branchesController.deleteBranch
);

export default router;
