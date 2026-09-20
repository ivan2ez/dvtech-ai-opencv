import type { ServiceTimeSlot } from '@/types';

/**
 * Shared presentation and matching helpers for service requests.
 *
 * The reference code (SR-0005) is the customer's ticket number: it's shown on
 * both the customer's and the admin's records tables so a caller can quote it
 * and the admin can find the row immediately.
 */

const REFERENCE_PREFIX = 'SR';
const REFERENCE_DIGITS = 4;

/** Formats a request id as its customer-facing ticket code, e.g. 5 → "SR-0005". */
export function formatRequestReference(id: number): string {
  return `${REFERENCE_PREFIX}-${String(id).padStart(REFERENCE_DIGITS, '0')}`;
}

/**
 * True when a search query looks like it's targeting this request's id.
 *
 * Deliberately forgiving so the admin can type whatever's in front of them:
 * "SR-0005", "sr0005", "#5", "0005" and "5" all match request 5. Digit-only
 * queries compare numerically so leading zeros don't matter.
 */
export function matchesRequestReference(id: number, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return false;

  const reference = formatRequestReference(id).toLowerCase();

  // Full or partial match against the formatted code ("sr-0005", "sr-00").
  if (reference.includes(needle)) return true;

  // Same, ignoring the separator and any leading '#'.
  const compact = needle.replace(/[\s#-]/g, '');
  if (compact.length === 0) return false;
  if (reference.replace('-', '').includes(compact)) return true;

  // Bare numbers: compare numerically so "5", "05" and "0005" all hit id 5.
  if (/^\d+$/.test(compact)) {
    return Number(compact) === id;
  }

  return false;
}

/** Human-readable label for each bookable half-day slot. */
export const TIME_SLOT_LABELS: Record<ServiceTimeSlot, string> = {
  morning: 'Morning (8:00 AM - 11:59 AM)',
  afternoon: 'Afternoon (12:00 PM - 5:00 PM)',
};

/** Short label for tables where the full range would not fit. */
export const TIME_SLOT_SHORT_LABELS: Record<ServiceTimeSlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
};

export function formatSlotLabel(slot: ServiceTimeSlot | null | undefined): string {
  return slot ? TIME_SLOT_LABELS[slot] : '—';
}

/** Formats a YYYY-MM-DD date as "Sep 12, 2026" without timezone drift. */
export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  // Append a time so the string is parsed in local time rather than as UTC
  // midnight, which would render as the previous day west of GMT.
  const date = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * The customer's chosen schedule as one line, e.g.
 * "Sep 12, 2026 - Morning (8:00 AM - 11:59 AM)".
 *
 * This is what fills the admin's "Required Date and Time", so the admin never
 * types a date by hand.
 */
export function formatRequiredSchedule(
  date: string | null | undefined,
  slot: ServiceTimeSlot | null | undefined
): string {
  if (!date) return '—';
  const formattedDate = formatDateOnly(date);
  if (formattedDate === '—') return '—';
  return slot ? `${formattedDate} - ${TIME_SLOT_LABELS[slot]}` : formattedDate;
}
