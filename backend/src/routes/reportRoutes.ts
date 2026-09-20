import { Router } from 'express';
import {
  generateReportHandler,
  listReportsHandler,
  getReportByIdHandler,
  exportReportHandler,
  listArchivedReportsHandler,
  archiveReportHandler,
  restoreReportHandler,
  deleteReportPermanentlyHandler,
} from '../controllers/reportController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';

const router = Router();

// All report routes are admin-only
router.post('/generate', authMiddleware, roleMiddleware('admin'), generateReportHandler);
router.get('/', authMiddleware, roleMiddleware('admin'), listReportsHandler);
// 'archived' before '/:id' so the literal path isn't captured as an id.
router.get('/archived', authMiddleware, roleMiddleware('admin'), listArchivedReportsHandler);
router.get('/:id', authMiddleware, roleMiddleware('admin'), getReportByIdHandler);
router.get('/:id/export', authMiddleware, roleMiddleware('admin'), exportReportHandler);
router.delete('/:id/archive', authMiddleware, roleMiddleware('admin'), archiveReportHandler);
router.post('/:id/restore', authMiddleware, roleMiddleware('admin'), restoreReportHandler);
router.delete('/:id/permanent', authMiddleware, roleMiddleware('admin'), deleteReportPermanentlyHandler);

export default router;
