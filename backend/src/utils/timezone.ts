/**
 * Asia/Manila timezone helpers — the single source of truth for turning a
 * half-day booking (calendar date + slot) into a real instant, and for pinning
 * an arbitrary client-submitted instant to its Manila calendar day.
 *
 * Manila is UTC+8 year-round (no daylight saving), so the offset is a constant
 * rather than a lookup. Centralizing it here means reschedule expiry (Req 10)
 * and the technician start-time gate (Req 15) share one implementation, and no
 * controller re-derives the offset by hand (Req 19.2).
 */

/** Asia/Manila is UTC+8 with no DST, i.e. 480 minutes ahead of UTC. */
export const MANILA_UTC_OFFSET_MINUTES = 480;

/** ISO-ish offset suffix (`+08:00`) used when building Manila instants. */
const MANILA_OFFSET_SUFFIX = '+08:00';

/** Half-day booking window. Mirrors `ServiceTimeSlot` on the ServiceRequest model. */
export type TimeSlot = 'morning' | 'afternoon';

/** Wall-clock start time (Asia/Manila) for each slot: Morning 08:00, Afternoon 12:00 (Req 15.1). */
const SLOT_START_HOUR: Record<TimeSlot, string> = {
  morning: '08:00:00',
  afternoon: '12:00:00',
};

/** A YYYY-MM-DD Manila calendar date. */
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shape of the field-scoped validation error thrown when a date/slot cannot be
 * resolved (Req 10.5). It carries a `statusCode` and a `field`/`message` pair so
 * callers (e.g. Reschedule_Service) can surface which input was unresolvable,
 * matching the `httpError` convention used across the service layer.
 */
export interface SlotValidationError extends Error {
  statusCode: number;
  field: string;
}

function slotValidationError(field: string, message: string): SlotValidationError {
  const error = new Error(message) as SlotValidationError;
  error.statusCode = 400;
  error.field = field;
  return error;
}

/**
 * Returns the start instant of a Manila calendar date + slot.
 *
 * Morning resolves to 08:00 and Afternoon to 12:00, both at the Manila offset
 * (`+08:00`), so `slotStartInstant('2025-09-30', 'morning')` equals
 * `new Date('2025-09-30T08:00:00+08:00')` (Req 15.1).
 *
 * Throws a typed validation error identifying the unresolvable field when the
 * date is malformed or the slot is not a known value (Req 10.5).
 */
export function slotStartInstant(date: string, slot: TimeSlot): Date {
  const rawDate = typeof date === 'string' ? date.trim() : '';
  if (!DATE_ONLY_REGEX.test(rawDate)) {
    throw slotValidationError('date', 'Date must be a valid YYYY-MM-DD calendar date');
  }

  const startTime = SLOT_START_HOUR[slot];
  if (!startTime) {
    throw slotValidationError('slot', "Slot must be either 'morning' or 'afternoon'");
  }

  const instant = new Date(`${rawDate}T${startTime}${MANILA_OFFSET_SUFFIX}`);
  // A calendar date that passes the shape check but is not a real day
  // (e.g. 2025-02-30) yields an Invalid Date; treat that as unresolvable too.
  if (Number.isNaN(instant.getTime())) {
    throw slotValidationError('date', 'Date must be a valid YYYY-MM-DD calendar date');
  }

  return instant;
}

/** The reschedule response window, fixed at 48 hours (Req 10.1). */
export const RESCHEDULE_WINDOW_HOURS = 48;
const RESCHEDULE_WINDOW_MS = RESCHEDULE_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * Computes a reschedule proposal's expiry as the earlier of two instants
 * (Req 10.1, 10.4): the creation time plus 48 hours, and the start instant of
 * the proposed date + slot. When the two coincide the shared instant is
 * returned (Req 10.2), which `Math.min` already yields.
 *
 * The proposed date/slot is resolved through `slotStartInstant`, so an
 * unresolvable date or slot surfaces as the same typed `SlotValidationError`
 * (statusCode 400, field) — callers catch it to reject the proposal without
 * creating it (Req 10.5). Centralizing the min here keeps expiry computed
 * through one shared function (Req 10.4).
 */
export function computeRescheduleExpiry(
  createdAt: Date,
  proposedDate: string,
  proposedSlot: TimeSlot
): Date {
  const windowExpiry = createdAt.getTime() + RESCHEDULE_WINDOW_MS;
  const slotStart = slotStartInstant(proposedDate, proposedSlot).getTime();
  return new Date(Math.min(windowExpiry, slotStart));
}

/**
 * Formats an instant as a Manila date-and-time for display to admins and
 * customers (Req 10.9), e.g. "Sep 30, 2025, 8:00 AM".
 */
export function formatManilaDateTime(instant: Date): string {
  return instant.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Extracts the Manila calendar date (YYYY-MM-DD) from an arbitrary client
 * instant (Req 19.5, 6.7).
 *
 * A client may submit a `Date` or an ISO string carrying a non-Manila offset or
 * no offset at all. We convert to the equivalent Manila wall-clock day by
 * shifting the UTC instant forward by the Manila offset and reading the
 * date parts, so the stored `YYYY-MM-DD` matches what a Manila user sees.
 *
 * Throws a typed validation error when the value cannot be parsed into an
 * instant.
 */
export function manilaDateFromInput(value: string | Date): string {
  const instant = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(instant.getTime())) {
    throw slotValidationError('date', 'Value must be a valid date or date-time');
  }

  // Shift the absolute instant into Manila local time, then read the UTC parts
  // of the shifted value — those now spell the Manila wall-clock day.
  const manilaMs = instant.getTime() + MANILA_UTC_OFFSET_MINUTES * 60 * 1000;
  const manila = new Date(manilaMs);
  const year = manila.getUTCFullYear();
  const month = String(manila.getUTCMonth() + 1).padStart(2, '0');
  const day = String(manila.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
