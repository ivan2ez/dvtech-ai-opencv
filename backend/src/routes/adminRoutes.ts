import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { handleValidationErrors } from '../middlewares/validationMiddleware';
import {
  createTechnicianValidation,
  updateTechnicianValidation,
  idParamValidation,
} from '../utils/validators';
import {
  getDashboardStatsHandler,
  getCustomersHandler,
  getTechniciansHandler,
  createTechnicianHandler,
  updateTechnicianHandler,
  customerAccountHandlers,
  technicianAccountHandlers,
} from '../controllers/adminController';

const router = Router();

/** Every admin route requires a valid token plus the admin role. */
const adminOnly = [authMiddleware, roleMiddleware('admin')];

// Dashboard stats
router.get(
  '/stats',
  authMiddleware,
  roleMiddleware('admin'),
  getDashboardStatsHandler
);

// All admin routes require authentication + admin role
router.get(
  '/customers',
  authMiddleware,
  roleMiddleware('admin'),
  getCustomersHandler
);

// Customer archive. Declared before '/customers/:id/...' so the literal
// 'archived' segment is never captured as an :id.
router.get('/customers/archived', ...adminOnly, customerAccountHandlers.listArchived);

// Activate/Deactivate toggle
router.patch(
  '/customers/:id/status',
  ...adminOnly,
  idParamValidation,
  handleValidationErrors,
  customerAccountHandlers.setStatus
);

// Soft delete → archive (rejected while the account is still active)
router.delete(
  '/customers/:id',
  ...adminOnly,
  idParamValidation,
  handleValidationErrors,
  customerAccountHandlers.archive
);

router.post(
  '/customers/:id/restore',
  ...adminOnly,
  idParamValidation,
  handleValidationErrors,
  customerAccountHandlers.restore
);

router.get(
  '/customers/:id/deletion-impact',
  ...adminOnly,
  idParamValidation,
  handleValidationErrors,
  customerAccountHandlers.deletionImpact
);

router.delete(
  '/customers/:id/permanent',
  ...adminOnly,
  idParamValidation,
  handleValidationErrors,
  customerAccountHandlers.purge
);

// Technician management routes
router.get(
  '/technicians',
  authMiddleware,
  roleMiddleware('admin'),
  getTechniciansHandler
);

router.get('/technicians/archived', ...adminOnly, technicianAccountHandlers.listArchived);

router.post(
  '/technicians',
  authMiddleware,
  roleMiddleware('admin'),
  createTechnicianValidation,
  handleValidationErrors,
  createTechnicianHandler
);

router.put(
  '/technicians/:id',
  authMiddleware,
  roleMiddleware('admin'),
  idParamValidation,
  updateTechnicianValidation,
  handleValidationErrors,
  updateTechnicianHandler
);

// Activate/Deactivate toggle
router.patch(
  '/technicians/:id/status',
  ...adminOnly,
  idParamValidation,
  handleValidationErrors,
  technicianAccountHandlers.setStatus
);

// Soft delete → archive (rejected while the account is still active)
router.delete(
  '/technicians/:id',
  ...adminOnly,
  idParamValidation,
  handleValidationErrors,
  technicianAccountHandlers.archive
);

router.post(
  '/technicians/:id/restore',
  ...adminOnly,
  idParamValidation,
  handleValidationErrors,
  technicianAccountHandlers.restore
);

router.get(
  '/technicians/:id/deletion-impact',
  ...adminOnly,
  idParamValidation,
  handleValidationErrors,
  technicianAccountHandlers.deletionImpact
);

router.delete(
  '/technicians/:id/permanent',
  ...adminOnly,
  idParamValidation,
  handleValidationErrors,
  technicianAccountHandlers.purge
);

export default router;
