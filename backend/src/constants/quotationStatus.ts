/**
 * Placeholder quotation status vocabulary (Requirement 4.10, 5.1, 5.2).
 *
 * ASSUMPTION — pending `INQUIRY.DOCX`, which was not provided in the workspace.
 * These status values are a clearly-marked placeholder. Per Requirement 5 the
 * vocabulary is isolated behind this single constants module (mirrored on the
 * frontend at `frontend/src/constants/quotationStatus.ts`) so it can be
 * swapped wholesale when `INQUIRY.DOCX` arrives — a one-file change plus a
 * migration to remap the ENUM. Every consumer MUST read from this constant
 * (never a status string literal) so the swap stays contained here.
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
 * All placeholder status values, useful for building Sequelize ENUM columns and
 * validation lists without re-typing the literals (Req 5.2, 13.2 pattern).
 */
export const QUOTATION_STATUS_VALUES: QuotationStatus[] = Object.values(QUOTATION_STATUS);

/**
 * The single status at which a quotation-based request enters the
 * "Requests Awaiting Scheduling" list (Req 11.5, 11.6).
 */
export const AWAITING_SCHEDULING_STATUS: QuotationStatus = QUOTATION_STATUS.Paid;
