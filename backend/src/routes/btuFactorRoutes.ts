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
} from '../controllers/btuFactorController';

const router = Router();

// All routes are admin-only (require auth + admin role)
router.get('/', authMiddleware, roleMiddleware('admin'), getAllBtuFactors);
router.get('/:id', authMiddleware, roleMiddleware('admin'), getBtuFactorById);
router.post('/', authMiddleware, roleMiddleware('admin'), createBtuFactorValidation, handleValidationErrors, createBtuFactor);
router.put('/:id', authMiddleware, roleMiddleware('admin'), updateBtuFactorValidation, handleValidationErrors, updateBtuFactor);
router.delete('/:id', authMiddleware, roleMiddleware('admin'), deleteBtuFactor);

export default router;
