import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import {
  getAllBrands,
  createBrand,
  updateBrand,
  deleteBrand,
} from '../controllers/brandController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for logos
});

// Public
router.get('/', getAllBrands);

// Admin only (with optional logo upload)
router.post('/', authMiddleware, roleMiddleware('admin'), upload.single('logo'), createBrand);
router.put('/:id', authMiddleware, roleMiddleware('admin'), upload.single('logo'), updateBrand);
router.delete('/:id', authMiddleware, roleMiddleware('admin'), deleteBrand);

export default router;
