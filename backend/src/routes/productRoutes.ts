import { Router } from 'express';
import multer from 'multer';
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
  getArchivedProducts,
  archiveProduct,
  restoreProduct,
  deleteProductPermanently,
} from '../controllers/productController';
import {
  listProductImages,
  uploadProductImages,
  setCoverImage,
  deleteProductImage,
} from '../controllers/productImageController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Public routes
router.get('/', getAllProducts);
// Admin: archived products. Before '/:id' so 'archived' isn't read as an id.
router.get('/archived', authMiddleware, roleMiddleware('admin'), getArchivedProducts);
router.get('/:id', getProductById);

// Product images (public: list images)
router.get('/:productId/images', listProductImages);

// Admin-only routes (require auth + admin role)
router.post('/', authMiddleware, roleMiddleware('admin'), createProductValidation, handleValidationErrors, createProduct);
router.put('/:id', authMiddleware, roleMiddleware('admin'), updateProductValidation, handleValidationErrors, updateProduct);
// Archive (soft delete) is separate from deactivate (DELETE /:id).
router.delete('/:id/archive', authMiddleware, roleMiddleware('admin'), archiveProduct);
router.post('/:id/restore', authMiddleware, roleMiddleware('admin'), restoreProduct);
router.delete('/:id/permanent', authMiddleware, roleMiddleware('admin'), deleteProductPermanently);
router.delete('/:id', authMiddleware, roleMiddleware('admin'), deleteProduct);

// Admin-only: product image management
router.post('/:productId/images', authMiddleware, roleMiddleware('admin'), upload.array('images', 10), uploadProductImages);
router.patch('/:productId/images/:imageId/cover', authMiddleware, roleMiddleware('admin'), setCoverImage);
router.delete('/:productId/images/:imageId', authMiddleware, roleMiddleware('admin'), deleteProductImage);

export default router;
