import { Op } from 'sequelize';
import { ServiceRequest, TechnicianDetail, TechnicianSchedule, User } from '../models';

// --- Types ---

export interface AssignTechnicianInput {
  technicianId: number;
  serviceRequestId: number;
  scheduledDate: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface ValidationError {
  field: string;
  message: string;
}

// --- Constants ---

const VALID_PRIORITIES: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

// --- Validation Helpers ---

function validateAssignInput(input: AssignTechnicianInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.technicianId) {
    errors.push({ field: 'technicianId', message: 'Technician ID is required' });
  }

  if (!input.serviceRequestId) {
    errors.push({ field: 'serviceRequestId', message: 'Service request ID is required' });
  }

  if (!input.scheduledDate || input.scheduledDate.trim().length === 0) {
    errors.push({ field: 'scheduledDate', message: 'Scheduled date is required' });
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(input.scheduledDate.trim())) {
      errors.push({ field: 'scheduledDate', message: 'Scheduled date must be in YYYY-MM-DD format' });
    } else {
      // Validate date is today or in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const scheduled = new Date(input.scheduledDate.trim() + 'T00:00:00');
      if (isNaN(scheduled.getTime())) {
        errors.push({ field: 'scheduledDate', message: 'Scheduled date is not a valid date' });
      } else if (scheduled < today) {
        errors.push({ field: 'scheduledDate', message: 'Scheduled date must be today or in the future' });
      }
    }
  }

  if (input.priority && !VALID_PRIORITIES.includes(input.priority)) {
    errors.push({ field: 'priority', message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
  }

  return errors;
}

// --- Service ---

export async function assignTechnician(input: AssignTechnicianInput): Promise<TechnicianSchedule> {
  // 1. Validate input
  const validationErrors = validateAssignInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Validate service request exists and has 'approved' status
  const serviceRequest = await ServiceRequest.findByPk(input.serviceRequestId);
  if (!serviceRequest) {
    const error = new Error('Service request not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  if (serviceRequest.status !== 'approved') {
    const error = new Error('Service request must have approved status to be assigned') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  // 3. Check technician exists and availability_status is 'available'
  const technician = await TechnicianDetail.findOne({
    where: { userId: input.technicianId },
  });

  if (!technician) {
    const error = new Error('Technician not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  if (technician.availabilityStatus !== 'available') {
    const error = new Error('Technician is not available') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  // 4. Check for scheduling conflicts (technician already has active task on same date)
  const scheduledDate = input.scheduledDate.trim();
  const existingSchedule = await TechnicianSchedule.findOne({
    where: {
      technicianId: input.technicianId,
      scheduledDate,
      status: {
        [Op.notIn]: ['completed', 'rejected'],
      },
    },
  });

  if (existingSchedule) {
    const error = new Error('Technician already has an active task scheduled on this date') as Error & { statusCode: number };
    error.statusCode = 409;
    throw error;
  }

  // 5. Create TECHNICIAN_SCHEDULE with 'assigned' status and priority
  const priority = input.priority || 'medium';
  const schedule = await TechnicianSchedule.create({
    technicianId: input.technicianId,
    serviceRequestId: input.serviceRequestId,
    scheduledDate,
    status: 'assigned',
    priority,
  });

  // 6. Update service request status to 'assigned'
  serviceRequest.status = 'assigned';
  await serviceRequest.save();

  return schedule;
}


// --- Additional Types ---

export interface ListSchedulesOptions {
  userId: number;
  role: string;
  page?: number;
  pageSize?: number;
}

// --- Technician Action Functions ---

export async function acceptTask(scheduleId: number, technicianId: number): Promise<TechnicianSchedule> {
  const schedule = await TechnicianSchedule.findByPk(scheduleId);

  if (!schedule) {
    const error = new Error('Schedule not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  if (schedule.technicianId !== technicianId) {
    const error = new Error('You are not authorized to modify this schedule') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  if (schedule.status !== 'assigned') {
    const error = new Error('Task can only be accepted when status is assigned') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  schedule.status = 'accepted';
  await schedule.save();

  return schedule;
}

export async function rejectTask(scheduleId: number, technicianId: number, reason: string): Promise<TechnicianSchedule> {
  // Validate reason
  if (!reason || reason.trim().length < 10) {
    const error = new Error('Rejection reason must be at least 10 characters') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  const schedule = await TechnicianSchedule.findByPk(scheduleId);

  if (!schedule) {
    const error = new Error('Schedule not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  if (schedule.technicianId !== technicianId) {
    const error = new Error('You are not authorized to modify this schedule') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  if (schedule.status !== 'assigned') {
    const error = new Error('Task can only be rejected when status is assigned') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  // Update schedule to rejected and store reason in report field
  schedule.status = 'rejected';
  schedule.report = reason.trim();
  await schedule.save();

  // Return the associated service request status to 'approved' so Admin can reassign
  const serviceRequest = await ServiceRequest.findByPk(schedule.serviceRequestId);
  if (serviceRequest) {
    serviceRequest.status = 'approved';
    await serviceRequest.save();
  }

  return schedule;
}

export async function updateTaskStatus(scheduleId: number, technicianId: number): Promise<TechnicianSchedule> {
  const schedule = await TechnicianSchedule.findByPk(scheduleId);

  if (!schedule) {
    const error = new Error('Schedule not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  if (schedule.technicianId !== technicianId) {
    const error = new Error('You are not authorized to modify this schedule') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  if (schedule.status !== 'accepted') {
    const error = new Error('Task can only be moved to in-progress when status is accepted') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  schedule.status = 'in-progress';
  await schedule.save();

  return schedule;
}

export async function completeTask(scheduleId: number, technicianId: number, report: string): Promise<TechnicianSchedule> {
  // Validate report
  if (!report || report.trim().length < 20) {
    const error = new Error('Completion report must be at least 20 characters') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  const schedule = await TechnicianSchedule.findByPk(scheduleId);

  if (!schedule) {
    const error = new Error('Schedule not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  if (schedule.technicianId !== technicianId) {
    const error = new Error('You are not authorized to modify this schedule') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  if (schedule.status !== 'in-progress') {
    const error = new Error('Task can only be completed when status is in-progress') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  schedule.status = 'completed';
  schedule.report = report.trim();
  await schedule.save();

  return schedule;
}

// --- List & Get Functions ---

export async function listSchedules(options: ListSchedulesOptions) {
  const { userId, role, page = 1, pageSize = 20 } = options;

  const offset = (page - 1) * pageSize;
  const limit = pageSize;

  // Build where clause based on role
  const where: Record<string, unknown> = {};
  if (role === 'technician') {
    where.technicianId = userId;
  }
  // Admin sees all — no filter needed

  const { rows, count } = await TechnicianSchedule.findAndCountAll({
    where,
    include: [
      {
        model: ServiceRequest,
        attributes: ['id', 'serviceType', 'acDetails', 'status'],
      },
      {
        model: User,
        as: 'technician',
        attributes: ['id', 'name', 'email'],
      },
    ],
    order: [['scheduledDate', 'ASC']],
    offset,
    limit,
  });

  return {
    schedules: rows,
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  };
}

export async function getScheduleById(id: number, userId: number, role: string): Promise<TechnicianSchedule> {
  const schedule = await TechnicianSchedule.findByPk(id, {
    include: [
      {
        model: ServiceRequest,
        attributes: ['id', 'serviceType', 'acDetails', 'status'],
      },
      {
        model: User,
        as: 'technician',
        attributes: ['id', 'name', 'email'],
      },
    ],
  });

  if (!schedule) {
    const error = new Error('Schedule not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // Technicians can only view their own schedules
  if (role === 'technician' && schedule.technicianId !== userId) {
    const error = new Error('You are not authorized to view this schedule') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  return schedule;
}
