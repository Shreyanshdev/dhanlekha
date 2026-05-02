import { Router } from 'express';
import * as customersController from './customers.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import validate from '../../middleware/validate.middleware';
import { createCustomerSchema, updateCustomerSchema, customerIdParamSchema } from './customers.validator';

const router = Router();

router.use(requireAuth);

router.get('/', customersController.listCustomers);
router.get('/:id', validate(customerIdParamSchema, 'params'), customersController.getCustomer);
router.post('/', validate(createCustomerSchema), customersController.createCustomer);
router.patch('/:id', validate(customerIdParamSchema, 'params'), validate(updateCustomerSchema), customersController.updateCustomer);
router.delete('/:id', validate(customerIdParamSchema, 'params'), customersController.deleteCustomer);

export default router;
