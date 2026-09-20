import { Router } from 'express';
import {
  assignTechnicianHandler,
  listSchedulesHandler,
  getScheduleByIdHandler,
  getAvailableTechniciansHandler,
  reassignTechnicianHandler,
  startTaskHandler,
  undoTaskStatusHandler,
  completeTaskHandler,
  listArchivedSchedulesHandler,
  archiveScheduleHandler,
  restoreScheduleHandler,
  permanentlyDeleteScheduleHandler,
} from '../controllers/scheduleController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { handleValidationErrors } from '../middlewares/validationMiddleware';
import { assignScheduleValidation } from '../utils/validators';

const router = Router();

// Admin assigns a technician to a service request
router.post('/', authMiddleware, roleMiddleware('admin'), assignScheduleValidation, handleValidationErrors, assignTechnicianHandler);

// Admin: available technicians for a date + slot (assignment dropdown source).
// Declared before '/:id' so the literal path isn't captured as an id.
router.get('/available-technicians', authMiddleware, roleMiddleware('admin'), getAvailableTechniciansHandler);

// Admin: archived schedules listing. Also before '/:id'.
router.get('/archived', authMiddleware, roleMiddleware('admin'), listArchivedSchedulesHandler);

// Admin and Technician can list schedules (role-based filtering in service)
router.get('/', authMiddleware, roleMiddleware('admin', 'technician'), listSchedulesHandler);

// Admin and Technician can view a specific schedule
router.get('/:id', authMiddleware, roleMiddleware('admin', 'technician'), getScheduleByIdHandler);

// Admin reassigns a task to another available technician (no-show / advance cancel)
router.patch('/:id/reassign', authMiddleware, roleMiddleware('admin'), reassignTechnicianHandler);

// Start a task: assigned -> in-progress (technician on own task, or admin)
router.patch('/:id/start', authMiddleware, roleMiddleware('admin', 'technician'), startTaskHandler);

// Undo an accidental start: in-progress -> assigned
router.patch('/:id/undo', authMiddleware, roleMiddleware('admin', 'technician'), undoTaskStatusHandler);

// Complete a task with report + required photo (multipart).
// The handler owns the multipart parse and the full validation order (missing
// field -> report length -> 413 oversize -> 415 unsupported type) so it returns
// the exact status codes deterministically and persists the photo only after
// all checks pass (Req 17.3, 17.4, 17.6, 17.7). Multer runs inside the handler,
// so no upload middleware or express-validator chain is wired here.
router.patch(
  '/:id/complete',
  authMiddleware,
  roleMiddleware('admin', 'technician'),
  completeTaskHandler
);

// Admin archive (soft delete → Archive view). Only completed/rejected schedules
// can be archived; restore/permanent are the recycle-bin follow-ups.
router.delete('/:id/archive', authMiddleware, roleMiddleware('admin'), archiveScheduleHandler);
router.post('/:id/restore', authMiddleware, roleMiddleware('admin'), restoreScheduleHandler);
router.delete('/:id/permanent', authMiddleware, roleMiddleware('admin'), permanentlyDeleteScheduleHandler);

export default router;
