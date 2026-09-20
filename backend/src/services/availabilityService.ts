import { Op } from 'sequelize';
import { TechnicianDetail, TechnicianSchedule, User } from '../models';
import { TASK_STATUS } from '../constants/taskStatus';

/**
 * Availability_Service (Requirements 7, 8, 9, 12, 13, 19.1).
 *
 * One shared answer to "which technicians can take a task for this date +
 * slot?" — used by Assign (Req 7), Reassign (Req 8), reassignment revalidation
 * (Req 9.6), and activation availability (Req 12.2). It consolidates the old
 * `getAvailableTechnicians` / `canAssignToSlot` availability logic that lived in
 * `scheduleService.ts`.
 *
 * The A2 defect this fixes: availability was partly read from
 * `TechnicianDetail.availabilityStatus`, which `syncTechnicianAvailability`
 * overwrote to `busy` for mid-task technicians, so technicians merely working a
 * different slot vanished from the dropdown. Availability here is computed
 * purely from the `technician_schedule` table for the exact date + slot, so a
 * task on a different date or a different slot is never a conflict (Req 7.2,
 * 7.4).
 */

export type TimeSlot = 'morning' | 'afternoon';

export interface AvailabilityQuery {
  /** YYYY-MM-DD Manila calendar day. */
  date: string;
  slot: TimeSlot;
  /**
   * Pre-filter: when set, this technician is removed from consideration
   * *before* the active-status and schedule-conflict checks run (Req 7.7, 8.2).
   */
  excludeTechnicianId?: number;
}

export interface AvailableTechnician {
  id: number;
  name: string;
  email: string;
  contactNumber: string | null;
  /** `busy` is removed from the model (Req 13); only these two remain. */
  availabilityStatus: 'available' | 'unavailable';
  tasksOnDate: number;
}

/** A technician may hold at most this many active tasks on a single day. */
const MAX_TASKS_PER_DAY = 2;

/**
 * Schedule statuses that still occupy the slot, i.e. a conflict. A rejected or
 * reassigned-away schedule no longer occupies the slot; soft-deleted rows are
 * excluded automatically by the paranoid default scope. Computed as the
 * complement of the "released" statuses so a new status is treated as occupying
 * by default (safer than an allow-list that silently ignores new values).
 */
const RELEASED_STATUSES: string[] = [TASK_STATUS.Rejected, TASK_STATUS.Reassigned];

/** Statuses that count against a technician's daily task cap. */
const ACTIVE_SCHEDULE_STATUSES = [
  TASK_STATUS.Assigned,
  TASK_STATUS.Accepted,
  TASK_STATUS.Reassigned,
  TASK_STATUS.InProgress,
] as const;

/**
 * Returns the technicians eligible for a date + slot, in the exact evaluation
 * order the design mandates:
 *
 *   1. pre-filter      — drop `excludeTechnicianId` before anything else (Req 7.7)
 *   2. active-account  — role technician, isActive, not soft-deleted (Req 7.1, 7.3)
 *   3. manual-unavailable — drop availabilityStatus === 'unavailable' (Req 13.5)
 *   4. schedule-conflict  — drop a non-cancelled schedule on the exact date + slot (Req 7.4)
 */
export async function getAvailableTechnicians(
  query: AvailabilityQuery
): Promise<AvailableTechnician[]> {
  const { date, slot, excludeTechnicianId } = query;

  // 2. Active-account filter: only technicians whose account is Active and not
  //    archived (paranoid default excludes soft-deleted rows).
  const technicians = await User.findAll({
    where: { role: 'technician', isActive: true },
    include: [{ model: TechnicianDetail, as: 'technicianDetail', required: true }],
  });

  const results: AvailableTechnician[] = [];
  for (const tech of technicians) {
    // 1. Pre-filter exclusion — removed before any further check.
    if (excludeTechnicianId != null && tech.id === excludeTechnicianId) continue;

    const detail = (tech as unknown as { technicianDetail?: TechnicianDetail }).technicianDetail;

    // 3. Manual-unavailable filter.
    if (detail?.availabilityStatus === 'unavailable') continue;

    // 4. Schedule-conflict filter — a non-cancelled schedule on the exact
    //    date + slot. A different date or slot is never a conflict.
    const conflict = await TechnicianSchedule.findOne({
      where: {
        technicianId: tech.id,
        scheduledDate: date,
        scheduledTime: slot,
        status: { [Op.notIn]: RELEASED_STATUSES },
      },
    });
    if (conflict) continue;

    const tasksOnDate = await TechnicianSchedule.count({
      where: {
        technicianId: tech.id,
        scheduledDate: date,
        status: { [Op.in]: [...ACTIVE_SCHEDULE_STATUSES] },
      },
    });

    results.push({
      id: tech.id,
      name: tech.name,
      email: tech.email,
      contactNumber: detail?.contactNumber ?? null,
      availabilityStatus: 'available',
      tasksOnDate,
    });
  }

  return results;
}

/**
 * Single-technician availability predicate reused by the assign and reassign
 * write paths so they validate through the same rules the dropdown reads.
 *
 * Applies the same evaluation order as `getAvailableTechnicians` for one
 * technician: active-account → manual-unavailable → schedule-conflict (exact
 * date + slot, non-cancelled). `excludeScheduleId` lets a reassignment ignore
 * its own row so re-validating a schedule against its current technician does
 * not treat that schedule as a self-conflict.
 *
 * NOTE: the 2-tasks/day cap is intentionally NOT enforced here — it is a
 * scheduling-policy constraint layered on top by `scheduleService.canAssignToSlot`
 * (Req 8.3). This predicate answers pure availability (Property 10).
 */
export async function isTechnicianAvailable(
  technicianId: number,
  query: AvailabilityQuery,
  excludeScheduleId?: number
): Promise<{ ok: boolean; reason?: string }> {
  const { date, slot } = query;

  const user = await User.findByPk(technicianId, { paranoid: false });
  if (!user || user.role !== 'technician') {
    return { ok: false, reason: 'Technician not found' };
  }
  if (!user.isActive || user.deletedAt) {
    return { ok: false, reason: 'Technician account is deactivated' };
  }

  const detail = await TechnicianDetail.findOne({ where: { userId: technicianId } });
  if (!detail) {
    return { ok: false, reason: 'Technician not found' };
  }
  if (detail.availabilityStatus === 'unavailable') {
    return { ok: false, reason: 'Technician is unavailable' };
  }

  const idFilter = excludeScheduleId ? { id: { [Op.ne]: excludeScheduleId } } : {};

  const conflict = await TechnicianSchedule.findOne({
    where: {
      technicianId,
      scheduledDate: date,
      scheduledTime: slot,
      status: { [Op.notIn]: RELEASED_STATUSES },
      ...idFilter,
    },
  });
  if (conflict) {
    return { ok: false, reason: `Technician already has a ${slot} task on ${date}` };
  }

  return { ok: true };
}

/**
 * Counts a technician's active tasks on a day, used by the 2-tasks/day cap in
 * `scheduleService.canAssignToSlot`. Exposed so the cap and the availability
 * checks share one definition of "active".
 */
export async function countActiveTasksOnDate(
  technicianId: number,
  date: string,
  excludeScheduleId?: number
): Promise<number> {
  const idFilter = excludeScheduleId ? { id: { [Op.ne]: excludeScheduleId } } : {};
  return TechnicianSchedule.count({
    where: {
      technicianId,
      scheduledDate: date,
      status: { [Op.in]: [...ACTIVE_SCHEDULE_STATUSES] },
      ...idFilter,
    },
  });
}

export { MAX_TASKS_PER_DAY };
