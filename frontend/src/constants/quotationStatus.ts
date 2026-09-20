/**
 * Placeholder quotation status vocabulary — frontend mirror
 * (Requirement 4.10, 5.1, 5.2).
 *
 * ASSUMPTION — pending `INQUIRY.DOCX`, which was not provided in the workspace.
 * This file MUST stay in lockstep with the backend source of truth at
 * `backend/src/constants/quotationStatus.ts`; the string values here are
 * identical to the backend's and a unit test asserts parity (Req 5.2). Per
 * Requirement 5 the vocabulary is isolated behind this single module so it can
 * be swapped wholesale when `INQUIRY.DOCX` arrives. All frontend status
 * comparisons, badges, and filter controls MUST read from this constant rather
 * than using literal strings.
 *
 * Assumed transitions: Submitted -> UnderReview -> Quoted -> Assigned -> Paid;
 * any -> Declined.
 * The Awaiting-Scheduling entry gate is exactly `Paid` (Req 11.5, 11.6).
 */

// PLACEHOLDER — replace with INQUIRY.DOCX vocabulary when provided (Req 5).
export const QUOTATION_STATUS = {
  Submitted: 'submitted',
  UnderReview: 'under-review',
  Quoted: 'quoted',
  Assigned: 'assigned',
  Paid: 'paid',
  Declined: 'declined',
} as const;

export type QuotationStatus = (typeof QUOTATION_STATUS)[keyof typeof QUOTATION_STATUS];

/**
 * All placeholder status values, useful for status filter dropdowns without
 * re-typing the literals (Req 5.2).
 */
export const QUOTATION_STATUS_VALUES: QuotationStatus[] = Object.values(QUOTATION_STATUS);

/**
 * The single status at which a quotation-based request enters the
 * "Requests Awaiting Scheduling" list (Req 11.5, 11.6).
 */
export const AWAITING_SCHEDULING_STATUS: QuotationStatus = QUOTATION_STATUS.Paid;
