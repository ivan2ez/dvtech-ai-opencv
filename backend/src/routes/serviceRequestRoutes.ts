import { Router } from 'express';
import {
  createServiceRequestHandler,
  listServiceRequestsHandler,
  getServiceRequestByIdHandler,
  approveServiceRequestHandler,
  rejectServiceRequestHandler,
} from '../controllers/serviceRequestController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { handleValidationErrors } from '../middlewares/validationMiddleware';
import {
  createServiceRequestValidation,
  rejectServiceRequestValidation,
} from '../utils/validators';

const router = Router();

// Customer creates a service request
router.post('/', authMiddleware, roleMiddleware('customer'), createServiceRequestValidation, handleValidationErrors, createServiceRequestHandler);

// Customer and Admin can list service requests (role-based filtering in service)
router.get('/', authMiddleware, roleMiddleware('customer', 'admin'), listServiceRequestsHandler);

// Customer and Admin can view a specific service request
router.get('/:id', authMiddleware, roleMiddleware('customer', 'admin'), getServiceRequestByIdHandler);

// Admin approves a service request
router.patch('/:id/approve', authMiddleware, roleMiddleware('admin'), approveServiceRequestHandler);

// Admin rejects a service request
router.patch('/:id/reject', authMiddleware, roleMiddleware('admin'), rejectServiceRequestValidation, handleValidationErrors, rejectServiceRequestHandler);

export default router;
