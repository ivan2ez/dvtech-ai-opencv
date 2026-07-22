import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import {
  getAllServiceTypes,
  getServiceTypeById,
  createServiceType,
  updateServiceType,
  deleteServiceType,
} from '../controllers/serviceTypeController';

const router = Router();

// Public routes
router.get('/', getAllServiceTypes);
router.get('/:id', getServiceTypeById);

// Admin-only routes (require auth + admin role)
router.post('/', authMiddleware, roleMiddleware('admin'), createServiceType);
router.put('/:id', authMiddleware, roleMiddleware('admin'), updateServiceType);
router.delete('/:id', authMiddleware, roleMiddleware('admin'), deleteServiceType);

export default router;
