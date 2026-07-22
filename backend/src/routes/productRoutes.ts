import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { handleValidationErrors } from '../middlewares/validationMiddleware';
import {
  createProductValidation,
  updateProductValidation,
} from '../utils/validators';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController';

const router = Router();

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Admin-only routes (require auth + admin role)
router.post('/', authMiddleware, roleMiddleware('admin'), createProductValidation, handleValidationErrors, createProduct);
router.put('/:id', authMiddleware, roleMiddleware('admin'), updateProductValidation, handleValidationErrors, updateProduct);
router.delete('/:id', authMiddleware, roleMiddleware('admin'), deleteProduct);

export default router;
