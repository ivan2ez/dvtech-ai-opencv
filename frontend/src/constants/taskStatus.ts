/**
 * Shared Task_Status_Enum — frontend mirror (Requirement 18.3, 18.4, 19.3).
 *
 * This file MUST stay in lockstep with the backend source of truth at
 * `backend/src/constants/taskStatus.ts`. The string values here are identical
 * to the backend's; a unit test asserts parity (Req 18.4). All frontend status
 * comparisons and badge/progression logic should read from this module rather
 * than using literal strings, eliminating the literal-string drift that let
 * Start set a value the completion check did not recognize.
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
 * Statuses from which a technician may start a task (Req 9.8, 15.6).
 */
export const STARTABLE_STATUSES: TaskStatus[] = [TASK_STATUS.Assigned, TASK_STATUS.Reassigned];
