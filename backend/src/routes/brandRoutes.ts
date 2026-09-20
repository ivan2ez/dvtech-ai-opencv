import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import {
  getAllBrands,
  getArchivedBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  restoreBrand,
  deleteBrandPermanently,
} from '../controllers/brandController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for logos
});

// Public
router.get('/', getAllBrands);

// Archive listing. Declared before '/:id' so 'archived' isn't read as an id.
router.get('/archived', authMiddleware, roleMiddleware('admin'), getArchivedBrands);

// Admin only (with optional logo upload)
router.post('/', authMiddleware, roleMiddleware('admin'), upload.single('logo'), createBrand);
router.put('/:id', authMiddleware, roleMiddleware('admin'), upload.single('logo'), updateBrand);

// Soft delete → archive
router.delete('/:id', authMiddleware, roleMiddleware('admin'), deleteBrand);
router.post('/:id/restore', authMiddleware, roleMiddleware('admin'), restoreBrand);
router.delete('/:id/permanent', authMiddleware, roleMiddleware('admin'), deleteBrandPermanently);

export default router;
