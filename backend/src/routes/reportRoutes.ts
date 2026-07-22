import { Router } from 'express';
import {
  generateReportHandler,
  listReportsHandler,
  getReportByIdHandler,
  exportReportHandler,
} from '../controllers/reportController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';

const router = Router();

// All report routes are admin-only
router.post('/generate', authMiddleware, roleMiddleware('admin'), generateReportHandler);
router.get('/', authMiddleware, roleMiddleware('admin'), listReportsHandler);
router.get('/:id', authMiddleware, roleMiddleware('admin'), getReportByIdHandler);
router.get('/:id/export', authMiddleware, roleMiddleware('admin'), exportReportHandler);

export default router;
