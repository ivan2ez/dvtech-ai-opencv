import { Op } from 'sequelize';
import sequelize from '../database/connection';
import {
  ServiceRequest,
  TechnicianDetail,
  TechnicianSchedule,
  User,
  ScheduleReassignment,
} from '../models';
import { TASK_STATUS, STARTABLE_STATUSES } from '../constants/taskStatus';
import { slotStartInstant, manilaDateFromInput } from '../utils/timezone';
import {
  isTechnicianAvailable,
  countActiveTasksOnDate,
  MAX_TASKS_PER_DAY,
} from './availabilityService';
import {
  archiveRecord,
  restoreRecord,
  permanentlyDeleteRecord,
  listArchivedRecords,
} from '../utils/archive';

// --- Types ---

export type TimeSlot = 'morning' | 'afternoon';

export interface AssignTechnicianInput {
  technicianId: number;
  serviceRequestId: number;
  scheduledDate: string;
  /** Half-day slot; defaults to the request's required time, else 'morning'. */
  scheduledTime?: TimeSlot;
  priority?: 'low' | 'medium' | 'high';
}

export interface ValidationError {
  field: string;
  message: string;
}

// --- Constants ---

const VALID_PRIORITIES: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
const VALID_TIME_SLOTS: TimeSlot[] = ['morning', 'afternoon'];

/** Schedule statuses that still occupy a slot (i.e. not finished/abandoned). */
const ACTIVE_SCHEDULE_STATUSES = [
  TASK_STATUS.Assigned,
  TASK_STATUS.Accepted,
  TASK_STATUS.InProgress,
] as const;

// --- Availability Helpers ---

/**
 * Recomputes a technician's availability from their live workload and syncs the
 * stored availability_status.
 *
 * Rules (from the revisions):
 *   - A deactivated account is always 'unavailable' (handled at the account
 *     level; we never flip it back to available here).
 *   - Otherwise the manual toggle stands: an 'unavailable' tech stays
 *     unavailable; everyone else is 'available'. (The `busy` state was removed
 *     in Req 13 — job eligibility is computed from the schedules table via the
 *     Availability_Service, not stored here. The 2-tasks/day cap is enforced
 *     per-slot at assignment time, not by a global status.)
 *
 * Returns the resulting status. Does nothing to a manually 'unavailable' tech
 * unless `force` is set, so admin-set leave/unavailability is respected.
 */
export async function syncTechnicianAvailability(
  technicianId: number,
  options: { force?: boolean } = {}
): Promise<'available' | 'unavailable'> {
  const detail = await TechnicianDetail.findOne({ where: { technicianId } });
  if (!detail) return 'unavailable';

  // If the account is deactivated, availability stays unavailable.
  const user = await User.findByPk(technicianId, { paranoid: false });
  if (!user || !user.isActive || user.deletedAt) {
    if (detail.availabilityStatus !== 'unavailable') {
      detail.availabilityStatus = 'unavailable';
      await detail.save();
    }
    return 'unavailable';
  }

  // Respect a manual 'unavailable' (e.g. leave) unless forced.
  if (detail.availabilityStatus === 'unavailable' && !options.force) {
    return 'unavailable';
  }

  // `busy` was removed (Req 13). Job eligibility for a date/slot is computed
  // from the schedules table by the Availability_Service, so this sync only
  // ever manages the manual available/unavailable toggle and the
  // deactivation→unavailable rule handled above. An active, non-manually-
  // unavailable technician is simply 'available'.
  const next: 'available' | 'unavailable' = 'available';
  if (detail.availabilityStatus !== next) {
    detail.availabilityStatus = next;
    await detail.save();
  }
  return next;
}

/**
 * Whether a technician can take another task in a given date + slot.
 *
 * Delegates the availability decision (active account, not manually
 * unavailable, exact date+slot free) to the shared `Availability_Service`
 * (`isTechnicianAvailable`) so the assign/reassign write paths validate through
 * the same code the dropdown reads (Req 19.1). It then layers on the
 * scheduling-policy 2-tasks/day cap, which is not part of pure availability.
 * `excludeScheduleId` lets a reassignment ignore its own row.
 */
export async function canAssignToSlot(
  technicianId: number,
  scheduledDate: string,
  slot: TimeSlot,
  excludeScheduleId?: number
): Promise<{ ok: boolean; reason?: string }> {
  // Shared availability check (pre-filter is not relevant to a single-tech
  // predicate, so it is omitted here).
  const available = await isTechnicianAvailable(
    technicianId,
    { date: scheduledDate, slot },
    excludeScheduleId
  );
  if (!available.ok) return available;

  // Scheduling-policy cap: at most 2 active tasks per day.
  const dayCount = await countActiveTasksOnDate(technicianId, scheduledDate, excludeScheduleId);
  if (dayCount >= MAX_TASKS_PER_DAY) {
    return { ok: false, reason: `Technician already has ${MAX_TASKS_PER_DAY} tasks on ${scheduledDate}` };
  }

  return { ok: true };
}

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

  if (input.scheduledTime && !VALID_TIME_SLOTS.includes(input.scheduledTime)) {
    errors.push({ field: 'scheduledTime', message: `Time slot must be one of: ${VALID_TIME_SLOTS.join(', ')}` });
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

  // 3. Check technician exists
  const technician = await TechnicianDetail.findOne({
    where: { userId: input.technicianId },
  });

  if (!technician) {
    const error = new Error('Technician not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // 4. Resolve the exact date + slot the dropdown was filtered on (Req 6.6).
  // The slot is precisely the one passed in — the value the technician
  // dropdown was filtered against; we only fall back to the request's required
  // time (then morning) when no slot was supplied at all. The stored date is
  // derived through the shared `manilaDateFromInput` so a client-submitted
  // value in any timezone is pinned to its Manila calendar day and the stored
  // date matches the displayed date (Req 6.7).
  const scheduledDate = manilaDateFromInput(input.scheduledDate.trim());
  const slot: TimeSlot =
    input.scheduledTime ??
    (serviceRequest.serviceRequiredTime as TimeSlot | null) ??
    'morning';

  // 5. Enforce availability + slot rules (active account, not unavailable,
  // slot free, under the 2-per-day cap). This replaces the old single-task
  // per-day check and the plain availability-status gate.
  const assignable = await canAssignToSlot(input.technicianId, scheduledDate, slot);
  if (!assignable.ok) {
    const error = new Error(assignable.reason || 'Technician cannot be assigned to this slot') as Error & {
      statusCode: number;
    };
    error.statusCode = 409;
    throw error;
  }

  // 6. Create the schedule row.
  const priority = input.priority || 'medium';
  const schedule = await TechnicianSchedule.create({
    technicianId: input.technicianId,
    serviceRequestId: input.serviceRequestId,
    scheduledDate,
    scheduledTime: slot,
    status: TASK_STATUS.Assigned,
    priority,
  });

  // 7. Update the request and keep the technician's availability in sync.
  serviceRequest.status = 'assigned';
  await serviceRequest.save();
  await syncTechnicianAvailability(input.technicianId);

  return schedule;
}

// --- Available Technicians for a slot (dropdown source) ---

export interface AvailableTechnician {
  id: number;
  name: string;
  email: string;
  contactNumber: string | null;
  availabilityStatus: 'available' | 'unavailable';
  tasksOnDate: number;
}

/**
 * Lists technicians who can take a task on the given date + slot, for the
 * admin's assignment dropdown. Only active, non-unavailable technicians with a
 * free slot and under the daily cap are returned — so unavailable/fully
 * booked technicians never appear (per the revisions).
 */
export async function getAvailableTechnicians(
  scheduledDate: string,
  slot: TimeSlot
): Promise<AvailableTechnician[]> {
  const technicians = await User.findAll({
    where: { role: 'technician', isActive: true },
    include: [{ model: TechnicianDetail, as: 'technicianDetail', required: true }],
  });

  const results: AvailableTechnician[] = [];
  for (const tech of technicians) {
    const check = await canAssignToSlot(tech.id, scheduledDate, slot);
    if (!check.ok) continue;

    const tasksOnDate = await TechnicianSchedule.count({
      where: {
        technicianId: tech.id,
        scheduledDate,
        status: { [Op.in]: [...ACTIVE_SCHEDULE_STATUSES] },
      },
    });

    const detail = (tech as unknown as { technicianDetail?: TechnicianDetail }).technicianDetail;
    results.push({
      id: tech.id,
      name: tech.name,
      email: tech.email,
      contactNumber: detail?.contactNumber ?? null,
      availabilityStatus: detail?.availabilityStatus ?? 'available',
      tasksOnDate,
    });
  }

  return results;
}


// --- Additional Types ---

export interface ListSchedulesOptions {
  userId: number;
  role: string;
  page?: number;
  pageSize?: number;
}

// --- Technician Action Functions ---

/**
 * Starts a task: assigned -> in-progress. The technician's eligibility for
 * other slots is computed from the schedules table by the Availability_Service,
 * so an in-progress task on one slot no longer flips a stored `busy` state.
 *
 * `actorRole` allows an admin to drive the status too (per the revisions),
 * while a technician may only start their own task.
 */
export async function startTask(
  scheduleId: number,
  actorUserId: number,
  actorRole: string
): Promise<TechnicianSchedule> {
  const schedule = await TechnicianSchedule.findByPk(scheduleId);
  if (!schedule) {
    const error = new Error('Schedule not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  if (actorRole !== 'admin' && schedule.technicianId !== actorUserId) {
    const error = new Error('You are not authorized to modify this schedule') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  if (!STARTABLE_STATUSES.includes(schedule.status)) {
    const error = new Error(
      `Task can only be started when its status is one of: ${STARTABLE_STATUSES.join(', ')}`
    ) as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  // Start-time gate (Req 15.1, 15.5, 15.7): a task cannot be started before the
  // Manila start instant of its assigned date + slot. `slotStartInstant`
  // returns an absolute instant at the Manila offset, so comparing it against
  // the current absolute time (`Date.now()`) is timezone-safe. An unresolvable
  // date/slot surfaces as the shared typed validation error (statusCode 400).
  const slot = (schedule.scheduledTime as TimeSlot | null) ?? 'morning';
  const startAt = slotStartInstant(schedule.scheduledDate, slot);
  if (Date.now() < startAt.getTime()) {
    const error = new Error(
      'This task cannot be started before its assigned date and time slot'
    ) as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  // For a reassigned task, re-check the new technician is still Active before
  // allowing the start (Req 9.8). An Assigned task does not need this because
  // its technician was validated at assignment; a Reassigned task may have sat
  // in the new technician's queue long enough for their account to change.
  if (schedule.status === TASK_STATUS.Reassigned) {
    const technician = await User.findByPk(schedule.technicianId, { paranoid: false });
    if (!technician || !technician.isActive || technician.deletedAt) {
      const error = new Error(
        'The assigned technician is no longer active and cannot start this task'
      ) as Error & { statusCode: number };
      error.statusCode = 403;
      throw error;
    }
  }

  // Persist In-Progress via the shared Task_Status_Enum on the same
  // TechnicianSchedule row that the completion check reads (Req 18.1, 18.3),
  // so a just-started task is never rejected on status grounds when completed.
  schedule.status = TASK_STATUS.InProgress;
  await schedule.save();
  await syncTechnicianAvailability(schedule.technicianId);

  return schedule;
}

/**
 * Reverts in-progress -> assigned (undo), guarding against accidental taps.
 * Only allowed while the task is in progress and before a completion report is
 * submitted (once completed it cannot be undone).
 */
export async function undoTaskStatus(
  scheduleId: number,
  actorUserId: number,
  actorRole: string
): Promise<TechnicianSchedule> {
  const schedule = await TechnicianSchedule.findByPk(scheduleId);
  if (!schedule) {
    const error = new Error('Schedule not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  if (actorRole !== 'admin' && schedule.technicianId !== actorUserId) {
    const error = new Error('You are not authorized to modify this schedule') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  if (schedule.status !== TASK_STATUS.InProgress) {
    const error = new Error('Only an in-progress task can be reverted') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  schedule.status = TASK_STATUS.Assigned;
  await schedule.save();
  await syncTechnicianAvailability(schedule.technicianId);

  return schedule;
}

/**
 * Completes a task: in-progress -> completed. Requires BOTH a written report
 * (min 20 chars) and a photo (per the revisions). Completing frees the
 * technician's availability for that day.
 */
export async function completeTask(
  scheduleId: number,
  actorUserId: number,
  actorRole: string,
  report: string,
  reportPhotoPath: string | null
): Promise<TechnicianSchedule> {
  if (!report || report.trim().length < 20) {
    const error = new Error('Completion report must be at least 20 characters') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  if (!reportPhotoPath) {
    const error = new Error('A completion photo is required') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = [{ field: 'photo', message: 'A completion photo is required' }];
    throw error;
  }

  const schedule = await TechnicianSchedule.findByPk(scheduleId);
  if (!schedule) {
    const error = new Error('Schedule not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  if (actorRole !== 'admin' && schedule.technicianId !== actorUserId) {
    const error = new Error('You are not authorized to modify this schedule') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  // Completion is only valid from In-Progress. Evaluate against the shared
  // Task_Status_Enum so this check can never drift from the value Start
  // persists (Req 18.3, 18.6), and name the current status in the message.
  // A non-In-Progress task is a status conflict, so respond 409 (Req 17.5).
  if (schedule.status !== TASK_STATUS.InProgress) {
    const error = new Error(
      `Task can only be completed when status is ${TASK_STATUS.InProgress} (current status: ${schedule.status})`
    ) as Error & { statusCode: number };
    error.statusCode = 409;
    throw error;
  }

  // Persist the report text, photo path, Completed status, and completion
  // timestamp together with the underlying service-request completion inside a
  // single transaction (Req 17.1, 17.8). On any unexpected fault the
  // transaction rolls back, the schedule status is left unchanged, and a 500
  // is surfaced with the stack trace logged (Req 17.9).
  try {
    await sequelize.transaction(async (transaction) => {
      schedule.status = TASK_STATUS.Completed;
      schedule.report = report.trim();
      schedule.reportPhotoPath = reportPhotoPath;
      schedule.completedAt = new Date();
      await schedule.save({ transaction });

      // Mark the underlying service request completed too.
      const serviceRequest = await ServiceRequest.findByPk(schedule.serviceRequestId, {
        transaction,
      });
      if (serviceRequest) {
        serviceRequest.status = 'completed';
        await serviceRequest.save({ transaction });
      }
    });
  } catch (err) {
    // The transaction has rolled back, so no partial completion was persisted
    // and the stored status remains In-Progress. Reload to discard the
    // in-memory field mutations set above before rethrowing.
    await schedule.reload();
    console.error(
      `[completeTask] Unexpected fault completing schedule ${scheduleId}:`,
      err instanceof Error ? err.stack : err
    );
    const error = new Error('Failed to complete task due to an unexpected error') as Error & {
      statusCode: number;
    };
    error.statusCode = 500;
    throw error;
  }

  // Recompute availability outside the transaction; the task moves
  // In-Progress→Completed with the technician's task counts/views reflecting
  // the committed status (Req 17.2).
  await syncTechnicianAvailability(schedule.technicianId);

  return schedule;
}

/**
 * Admin reassigns a task to a different technician (for a no-show or an advance
 * cancellation), keeping the same date + slot, and records an audit trail
 * (Req 9).
 *
 * Behaviour:
 *   - Reject when the current status is In-Progress or Completed — work that has
 *     started or finished cannot be moved (Req 9.7 → 409).
 *   - Server-validate the new technician is Active with no conflicting schedule
 *     for the schedule's date + slot via the shared `isTechnicianAvailable`
 *     predicate, ignoring this schedule's own row (Req 9.6 → 409).
 *   - In one `sequelize.transaction`, set `status = 'reassigned'`, set
 *     `technicianId = newTechnicianId`, and insert a `ScheduleReassignment`
 *     audit row (previous technician, new technician, acting admin, timestamp).
 *     All three writes are all-or-nothing (Req 9.1, 9.4, 9.5).
 *   - Because `listSchedules` filters by `technicianId`, the committed transfer
 *     automatically surfaces the schedule in the new technician's My_Tasks and
 *     removes it from the previous technician's list and counts (Req 9.2, 9.3).
 *
 * The `actingAdminId` is recorded on the audit row so the reassigning admin is
 * captured (Req 9.5).
 */
export async function reassignTechnician(
  scheduleId: number,
  newTechnicianId: number,
  actingAdminId: number
): Promise<TechnicianSchedule> {
  const schedule = await TechnicianSchedule.findByPk(scheduleId);
  if (!schedule) {
    const error = new Error('Schedule not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // Reject started or finished tasks (Req 9.7). Naming the current status keeps
  // the response actionable for the admin UI.
  if (
    schedule.status === TASK_STATUS.InProgress ||
    schedule.status === TASK_STATUS.Completed
  ) {
    const error = new Error(
      `A task that is ${schedule.status} cannot be reassigned`
    ) as Error & { statusCode: number };
    error.statusCode = 409;
    throw error;
  }

  // Server-side validation of the new technician against the shared
  // Availability_Service (Req 9.6): active account, not manually unavailable,
  // and no conflicting schedule for this exact date + slot. `excludeScheduleId`
  // ignores this schedule's own row so it is never treated as a self-conflict.
  const slot = (schedule.scheduledTime as TimeSlot | null) ?? 'morning';
  const available = await isTechnicianAvailable(
    newTechnicianId,
    { date: schedule.scheduledDate, slot },
    schedule.id
  );
  if (!available.ok) {
    const error = new Error(
      available.reason || 'That technician cannot take this slot'
    ) as Error & { statusCode: number };
    error.statusCode = 409;
    throw error;
  }

  const previousTechnicianId = schedule.technicianId;

  // Guard: reassigning to the same technician is a no-op that would otherwise
  // write a misleading audit row. Reject it explicitly.
  if (previousTechnicianId === newTechnicianId) {
    const error = new Error(
      'The task is already assigned to that technician'
    ) as Error & { statusCode: number };
    error.statusCode = 409;
    throw error;
  }

  // Apply the status change, the technician change, and the audit insert as one
  // atomic transaction — all-or-nothing (Req 9.1, 9.4, 9.5). If any write
  // faults, the transaction rolls back and no partial reassignment or orphan
  // audit row is left behind.
  await sequelize.transaction(async (transaction) => {
    schedule.status = TASK_STATUS.Reassigned;
    schedule.technicianId = newTechnicianId;
    await schedule.save({ transaction });

    await ScheduleReassignment.create(
      {
        scheduleId: schedule.id,
        previousTechnicianId,
        newTechnicianId,
        reassignedBy: actingAdminId,
        reassignedAt: new Date(),
      },
      { transaction }
    );
  });

  // Refresh both technicians' availability after the committed transfer.
  await syncTechnicianAvailability(previousTechnicianId);
  await syncTechnicianAvailability(newTechnicianId);

  return schedule;
}

// --- Admin archive (soft delete → Archive view) ---

/**
 * Archives a schedule row. Per the revisions a schedule can only be removed
 * once its work is finished, so archiving is refused unless the task is
 * completed or rejected — this prevents losing an in-flight assignment.
 */
export async function archiveSchedule(id: number): Promise<void> {
  const schedule = await TechnicianSchedule.findByPk(id);
  if (!schedule) {
    const error = new Error('Schedule not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }
  if (schedule.status !== TASK_STATUS.Completed && schedule.status !== TASK_STATUS.Rejected) {
    const error = new Error(
      'Only completed or rejected tasks can be archived.'
    ) as Error & { statusCode: number };
    error.statusCode = 409;
    throw error;
  }
  await archiveRecord(TechnicianSchedule, id, 'Schedule');
}

export async function restoreSchedule(id: number): Promise<void> {
  await restoreRecord(TechnicianSchedule, id, 'Schedule');
}

export async function permanentlyDeleteSchedule(id: number): Promise<void> {
  await permanentlyDeleteRecord(TechnicianSchedule, id, 'Schedule');
}

export async function findArchivedSchedules(): Promise<TechnicianSchedule[]> {
  return listArchivedRecords(TechnicianSchedule);
}

// --- List & Get Functions ---

/**
 * Computes the Manila start instant of a schedule's date + slot as an ISO
 * string, so the technician UI can gate the Start control on the same boundary
 * the server enforces (Req 15.2–15.4). Returns `null` when the date/slot cannot
 * be resolved (a defensive guard — the gate in `startTask` is authoritative).
 */
function computeStartableAt(scheduledDate: string, scheduledTime: 'morning' | 'afternoon' | null): string | null {
  const slot = (scheduledTime as TimeSlot | null) ?? 'morning';
  try {
    return slotStartInstant(scheduledDate, slot).toISOString();
  } catch {
    return null;
  }
}

/**
 * Serializes a schedule to a plain object and attaches `startableAt` (the
 * Manila slot start instant) so every task in a list/detail response carries
 * the boundary the Start control uses (Req 15.2–15.4).
 */
function withStartableAt(schedule: TechnicianSchedule): Record<string, unknown> {
  const json = schedule.toJSON() as Record<string, unknown>;
  json.startableAt = computeStartableAt(
    schedule.scheduledDate,
    schedule.scheduledTime
  );
  return json;
}

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
        attributes: [
          'id', 'serviceType', 'acDetails', 'status', 'userId', 'createdAt',
          'serviceStreet', 'serviceBarangay', 'serviceCity', 'serviceProvince', 'contactNumber',
        ],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'street', 'barangay', 'city', 'province'],
          },
        ],
      },
      {
        model: User,
        as: 'technician',
        attributes: ['id', 'name', 'email'],
        include: [
          {
            model: TechnicianDetail,
            as: 'technicianDetail',
            attributes: ['contactNumber', 'availabilityStatus', 'street', 'barangay', 'city', 'province'],
          },
        ],
      },
    ],
    order: [['scheduledDate', 'ASC']],
    offset,
    limit,
  });

  return {
    schedules: rows.map(withStartableAt),
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  };
}

export async function getScheduleById(id: number, userId: number, role: string): Promise<Record<string, unknown>> {
  const schedule = await TechnicianSchedule.findByPk(id, {
    include: [
      {
        model: ServiceRequest,
        attributes: [
          'id', 'serviceType', 'acDetails', 'status', 'userId', 'createdAt',
          'serviceStreet', 'serviceBarangay', 'serviceCity', 'serviceProvince', 'contactNumber',
        ],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'street', 'barangay', 'city', 'province'],
          },
        ],
      },
      {
        model: User,
        as: 'technician',
        attributes: ['id', 'name', 'email'],
        include: [
          {
            model: TechnicianDetail,
            as: 'technicianDetail',
            attributes: ['contactNumber', 'availabilityStatus', 'street', 'barangay', 'city', 'province'],
          },
        ],
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

  return withStartableAt(schedule);
}
