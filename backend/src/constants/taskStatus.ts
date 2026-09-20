/**
 * Shared Task_Status_Enum (Requirement 18.3, 18.4, 19.3).
 *
 * Single source of truth for TechnicianSchedule status values across the
 * backend. The frontend keeps an identical mirror at
 * `frontend/src/constants/taskStatus.ts`; a unit test asserts the two files
 * carry the same string values (Req 18.4). Never write these status strings as
 * literals — import from here so Start and the completion check can never drift
 * apart.
 */
export const TASK_STATUS = {
  Assigned: 'assigned',
  Accepted: 'accepted',
  Rejected: 'rejected',
  Reassigned: 'reassigned', // NEW (Req 9.1)
  InProgress: 'in-progress',
  Completed: 'completed',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

/**
 * Statuses from which a technician may start a task. A reassigned task is
 * startable by the new technician just like an assigned one (Req 9.8, 15.6).
 */
export const STARTABLE_STATUSES: TaskStatus[] = [TASK_STATUS.Assigned, TASK_STATUS.Reassigned];
