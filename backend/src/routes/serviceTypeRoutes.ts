import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import {
  getAllServiceTypes,
  getAllServiceTypesForAdmin,
  getServiceTypeById,
  createServiceType,
  updateServiceType,
  setServiceTypeAvailability,
  deleteServiceType,
  getArchivedServiceTypes,
  restoreServiceType,
  deleteServiceTypePermanently,
} from '../controllers/serviceTypeController';

const router = Router();

// Admin listing that includes Unavailable services. Declared before '/:id' so
// 'manage' isn't captured as an id.
router.get('/manage', authMiddleware, roleMiddleware('admin'), getAllServiceTypesForAdmin);
// Archived listing, likewise before '/:id'.
router.get('/archived', authMiddleware, roleMiddleware('admin'), getArchivedServiceTypes);

// Public routes — only Available services
router.get('/', getAllServiceTypes);
router.get('/:id', getServiceTypeById);

// Admin-only routes (require auth + admin role)
router.post('/', authMiddleware, roleMiddleware('admin'), createServiceType);
router.put('/:id', authMiddleware, roleMiddleware('admin'), updateServiceType);
router.patch(
  '/:id/availability',
  authMiddleware,
  roleMiddleware('admin'),
  setServiceTypeAvailability
);
router.post('/:id/restore', authMiddleware, roleMiddleware('admin'), restoreServiceType);
router.delete('/:id/permanent', authMiddleware, roleMiddleware('admin'), deleteServiceTypePermanently);
router.delete('/:id', authMiddleware, roleMiddleware('admin'), deleteServiceType);

export default router;
