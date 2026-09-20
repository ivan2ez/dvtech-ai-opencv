import { Router } from 'express';
import {
  createServiceRequestHandler,
  listServiceRequestsHandler,
  getServiceRequestByIdHandler,
  approveServiceRequestHandler,
  rejectServiceRequestHandler,
  proposeRescheduleHandler,
  respondToRescheduleHandler,
  softDeleteOwnRequestHandler,
  restoreOwnRequestHandler,
  permanentlyDeleteOwnRequestHandler,
  listArchivedServiceRequestsHandler,
  archiveServiceRequestHandler,
  restoreServiceRequestHandler,
  permanentlyDeleteServiceRequestHandler,
  listAwaitingSchedulingHandler,
} from '../controllers/serviceRequestController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { handleValidationErrors } from '../middlewares/validationMiddleware';
import {
  createServiceRequestValidation,
  rejectServiceRequestValidation,
  proposeRescheduleValidation,
  respondToRescheduleValidation,
} from '../utils/validators';

const router = Router();

// Customer creates a service request
router.post('/', authMiddleware, roleMiddleware('customer'), createServiceRequestValidation, handleValidationErrors, createServiceRequestHandler);

// Customer and Admin can list service requests (role-based filtering in service)
router.get('/', authMiddleware, roleMiddleware('customer', 'admin'), listServiceRequestsHandler);

// Admin archive listing. Before '/:id' so 'archived' isn't captured as an id.
router.get('/archived', authMiddleware, roleMiddleware('admin'), listArchivedServiceRequestsHandler);

// Admin "Requests Awaiting Scheduling" list (applies the quotation Paid-gate).
// Before '/:id' so the literal path isn't captured as an id (Req 11.5, 11.6).
router.get('/awaiting-scheduling', authMiddleware, roleMiddleware('admin'), listAwaitingSchedulingHandler);

// Customer and Admin can view a specific service request
router.get('/:id', authMiddleware, roleMiddleware('customer', 'admin'), getServiceRequestByIdHandler);

// Admin approves a service request
router.patch('/:id/approve', authMiddleware, roleMiddleware('admin'), approveServiceRequestHandler);

// Admin rejects a service request
router.patch('/:id/reject', authMiddleware, roleMiddleware('admin'), rejectServiceRequestValidation, handleValidationErrors, rejectServiceRequestHandler);

// Admin proposes a new schedule when no technician is available
router.patch(
  '/:id/reschedule',
  authMiddleware,
  roleMiddleware('admin'),
  proposeRescheduleValidation,
  handleValidationErrors,
  proposeRescheduleHandler
);

// Customer accepts or declines the proposed schedule (48-hour window)
router.patch(
  '/:id/reschedule/respond',
  authMiddleware,
  roleMiddleware('customer'),
  respondToRescheduleValidation,
  handleValidationErrors,
  respondToRescheduleHandler
);

// ── Admin archive (soft delete → Archive view; distinct paths from the
// customer recycle bin below so the two never collide) ──
router.delete('/:id/archive', authMiddleware, roleMiddleware('admin'), archiveServiceRequestHandler);
router.post('/:id/admin-restore', authMiddleware, roleMiddleware('admin'), restoreServiceRequestHandler);
router.delete('/:id/admin-permanent', authMiddleware, roleMiddleware('admin'), permanentlyDeleteServiceRequestHandler);

// ── Customer recycle bin (customer-scoped; does not affect the admin view) ──
// Restore is declared before the plain DELETE so the literal path is matched.
router.post('/:id/restore', authMiddleware, roleMiddleware('customer'), restoreOwnRequestHandler);
router.delete('/:id/permanent', authMiddleware, roleMiddleware('customer'), permanentlyDeleteOwnRequestHandler);
router.delete('/:id', authMiddleware, roleMiddleware('customer'), softDeleteOwnRequestHandler);

export default router;
