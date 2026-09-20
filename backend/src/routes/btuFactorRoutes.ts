import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { handleValidationErrors } from '../middlewares/validationMiddleware';
import {
  createBtuFactorValidation,
  updateBtuFactorValidation,
} from '../utils/validators';
import {
  getAllBtuFactors,
  getBtuFactorById,
  createBtuFactor,
  updateBtuFactor,
  deleteBtuFactor,
  getArchivedBtuFactors,
  restoreBtuFactor,
  deleteBtuFactorPermanently,
} from '../controllers/btuFactorController';

const router = Router();

// All routes are admin-only (require auth + admin role)
router.get('/', authMiddleware, roleMiddleware('admin'), getAllBtuFactors);
// 'archived' before '/:id' so the literal path isn't captured as an id.
router.get('/archived', authMiddleware, roleMiddleware('admin'), getArchivedBtuFactors);
router.get('/:id', authMiddleware, roleMiddleware('admin'), getBtuFactorById);
router.post('/', authMiddleware, roleMiddleware('admin'), createBtuFactorValidation, handleValidationErrors, createBtuFactor);
router.put('/:id', authMiddleware, roleMiddleware('admin'), updateBtuFactorValidation, handleValidationErrors, updateBtuFactor);
router.post('/:id/restore', authMiddleware, roleMiddleware('admin'), restoreBtuFactor);
router.delete('/:id/permanent', authMiddleware, roleMiddleware('admin'), deleteBtuFactorPermanently);
router.delete('/:id', authMiddleware, roleMiddleware('admin'), deleteBtuFactor);

export default router;
