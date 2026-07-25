import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import {
  getDashboardStatsHandler,
  getCustomersHandler,
  deactivateCustomerHandler,
  getTechniciansHandler,
  createTechnicianHandler,
  updateTechnicianHandler,
  deactivateTechnicianHandler,
} from '../controllers/adminController';

const router = Router();

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

router.patch(
  '/customers/:id/deactivate',
  authMiddleware,
  roleMiddleware('admin'),
  deactivateCustomerHandler
);

// Technician management routes
router.get(
  '/technicians',
  authMiddleware,
  roleMiddleware('admin'),
  getTechniciansHandler
);

router.post(
  '/technicians',
  authMiddleware,
  roleMiddleware('admin'),
  createTechnicianHandler
);

router.put(
  '/technicians/:id',
  authMiddleware,
  roleMiddleware('admin'),
  updateTechnicianHandler
);

router.patch(
  '/technicians/:id/deactivate',
  authMiddleware,
  roleMiddleware('admin'),
  deactivateTechnicianHandler
);

export default router;
