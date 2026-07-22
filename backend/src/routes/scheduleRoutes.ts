import { Router } from 'express';
import {
  assignTechnicianHandler,
  listSchedulesHandler,
  getScheduleByIdHandler,
  acceptTaskHandler,
  rejectTaskHandler,
  updateTaskStatusHandler,
  completeTaskHandler,
} from '../controllers/scheduleController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { handleValidationErrors } from '../middlewares/validationMiddleware';
import {
  assignScheduleValidation,
  rejectTaskValidation,
  completeTaskValidation,
} from '../utils/validators';

const router = Router();

// Admin assigns a technician to a service request
router.post('/', authMiddleware, roleMiddleware('admin'), assignScheduleValidation, handleValidationErrors, assignTechnicianHandler);

// Admin and Technician can list schedules (role-based filtering in service)
router.get('/', authMiddleware, roleMiddleware('admin', 'technician'), listSchedulesHandler);

// Admin and Technician can view a specific schedule
router.get('/:id', authMiddleware, roleMiddleware('admin', 'technician'), getScheduleByIdHandler);

// Technician accepts a task
router.patch('/:id/accept', authMiddleware, roleMiddleware('technician'), acceptTaskHandler);

// Technician rejects a task
router.patch('/:id/reject', authMiddleware, roleMiddleware('technician'), rejectTaskValidation, handleValidationErrors, rejectTaskHandler);

// Technician updates task status to in-progress
router.patch('/:id/status', authMiddleware, roleMiddleware('technician'), updateTaskStatusHandler);

// Technician completes a task with report
router.patch('/:id/complete', authMiddleware, roleMiddleware('technician'), completeTaskValidation, handleValidationErrors, completeTaskHandler);

export default router;
