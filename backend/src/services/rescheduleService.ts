import crypto from 'crypto';
import { Op } from 'sequelize';
import { ServiceRequest, TechnicianDetail, TechnicianSchedule, User } from '../models';
import type { ServiceTimeSlot } from '../models/ServiceRequest';
import { getAppBaseUrl, sendRescheduleProposalEmail } from './emailService';
import {
  computeRescheduleExpiry,
  formatManilaDateTime,
  RESCHEDULE_WINDOW_HOURS as SHARED_RESCHEDULE_WINDOW_HOURS,
  type SlotValidationError,
} from '../utils/timezone';

/**
 * Rescheduling flow for when no technician is available on the slot a customer
 * booked.
 *
 * The admin proposes a new date/time, which puts the request into
 * `needs-rescheduling` and emails the customer an action link. The customer has
 * exactly 48 hours to accept (→ `assigned`) or decline (→ `declined`, with
 * optional notes). Letting the window lapse moves it to `expired`.
 *
 * Expiry is evaluated lazily by `expireStaleReschedules`, which every read path
 * calls. That keeps the rule correct without depending on a background worker,
 * which matters because this API also runs serverless on Vercel.
 */

// --- Constants ---

/**
 * The response window, fixed at 48 hours by the spec. Re-exported from the
 * shared timezone helper so the window and the expiry math stay in lockstep
 * (Req 10.1, 10.4).
 */
export const RESCHEDULE_WINDOW_HOURS = SHARED_RESCHEDULE_WINDOW_HOURS;

const TIME_SLOTS: readonly ServiceTimeSlot[] = ['morning', 'afternoon'];

const DECLINE_NOTES_MAX_LENGTH = 500;

/** Statuses from which the admin may propose a new schedule. */
const RESCHEDULABLE_STATUSES = ['approved', 'assigned'] as const;

// --- Types ---

export interface ValidationError {
  field: string;
  message: string;
}

export interface ProposeRescheduleInput {
  serviceRequestId: number;
  proposedDate: string;
  proposedTime: ServiceTimeSlot;
  /** Optional: the admin may propose a date without committing a technician. */
  proposedTechnicianId?: number | null;
  reason?: string | null;
}

export interface ProposeRescheduleResult {
  serviceRequest: ServiceRequest;
  /** Whether the notification email actually went out. */
  emailDelivered: boolean;
  /** Deadline the customer was told about. */
  expiresAt: Date;
}

export type RescheduleAction = 'accept' | 'decline';

export interface RespondToRescheduleInput {
  serviceRequestId: number;
  userId: number;
  action: RescheduleAction;
  /** Optional free-text notes, only meaningful when declining. */
  notes?: string | null;
}

// --- Error helpers ---

function httpError(
  statusCode: number,
  message: string,
  errors?: ValidationError[]
): Error & { statusCode: number; errors?: ValidationError[] } {
  const error = new Error(message) as Error & {
    statusCode: number;
    errors?: ValidationError[];
  };
  error.statusCode = statusCode;
  if (errors) error.errors = errors;
  return error;
}

// --- Formatting helpers ---

const SLOT_LABELS: Record<ServiceTimeSlot, string> = {
  morning: 'morning (8:00 AM - 11:59 AM)',
  afternoon: 'afternoon (12:00 PM - 5:00 PM)',
};

/** Formats a YYYY-MM-DD date for display in emails, e.g. "Sep 20, 2026". */
function formatDateForDisplay(date: string | null): string {
  if (!date) return 'not set';
  const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'not set';
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "Sep 20, 2026, morning (8:00 AM - 11:59 AM)" */
function formatSchedule(date: string | null, slot: ServiceTimeSlot | null): string {
  const datePart = formatDateForDisplay(date);
  if (datePart === 'not set') return datePart;
  return slot ? `${datePart}, ${SLOT_LABELS[slot]}` : datePart;
}

/** Renders the expiry deadline as an Asia/Manila date-and-time (Req 10.9). */
function formatDeadline(deadline: Date): string {
  return formatManilaDateTime(deadline);
}

/** The customer-facing ticket code. Mirrors the frontend helper. */
export function formatRequestReference(id: number): string {
  return `SR-${String(id).padStart(4, '0')}`;
}

// --- Token helpers ---

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// --- Validation ---

function validateProposeInput(input: ProposeRescheduleInput): ValidationError[] {
  const errors: ValidationError[] = [];

  const rawDate = input.proposedDate ? String(input.proposedDate).trim() : '';
  if (rawDate.length === 0) {
    errors.push({ field: 'proposedDate', message: 'New date is required' });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    errors.push({ field: 'proposedDate', message: 'New date must be a valid date' });
  } else {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    if (rawDate < todayStr) {
      errors.push({ field: 'proposedDate', message: 'New date must be today or later' });
    }
  }

  if (!input.proposedTime || !TIME_SLOTS.includes(input.proposedTime)) {
    errors.push({
      field: 'proposedTime',
      message: `New time must be one of: ${TIME_SLOTS.join(', ')}`,
    });
  }

  if (input.reason && String(input.reason).trim().length > DECLINE_NOTES_MAX_LENGTH) {
    errors.push({
      field: 'reason',
      message: `Reason must not exceed ${DECLINE_NOTES_MAX_LENGTH} characters`,
    });
  }

  return errors;
}

// --- Expiry sweep ---

/**
 * Moves any proposal whose window has elapsed to `expired`.
 *
 * Safe and cheap to call before any read, and safe to run on a fixed schedule:
 * the WHERE clause only matches rows that are BOTH still `needs-rescheduling`
 * AND overdue. That makes the transition idempotent (Req 10.7) — once a row has
 * flipped to `expired` its status no longer satisfies the filter, so a second
 * (or hundredth) run matches zero extra rows and leaves the already-expired
 * proposals' status and expiry time untouched.
 *
 * Returns how many rows were expired by *this* call.
 */
export async function expireStaleReschedules(): Promise<number> {
  const [affected] = await ServiceRequest.update(
    {
      status: 'expired',
      rescheduleTokenHash: null,
    },
    {
      where: {
        status: 'needs-rescheduling',
        rescheduleExpiresAt: { [Op.lt]: new Date() },
      },
    }
  );
  return affected;
}

// --- Propose (admin) ---

/**
 * Records the admin's proposed schedule and notifies the customer.
 *
 * Only `approved` or `assigned` requests can be rescheduled — a pending request
 * should be approved first, and finished work is out of scope.
 */
export async function proposeReschedule(
  input: ProposeRescheduleInput
): Promise<ProposeRescheduleResult> {
  const validationErrors = validateProposeInput(input);
  if (validationErrors.length > 0) {
    throw httpError(400, 'Validation failed', validationErrors);
  }

  const serviceRequest = await ServiceRequest.findByPk(input.serviceRequestId, {
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'gmail'] }],
  });

  if (!serviceRequest) {
    throw httpError(404, 'Service request not found');
  }

  if (!RESCHEDULABLE_STATUSES.includes(serviceRequest.status as 'approved' | 'assigned')) {
    throw httpError(
      400,
      'Only approved or assigned requests can be rescheduled'
    );
  }

  // Validate the earmarked technician up front so the customer is never asked
  // to confirm a slot with a technician who can't take it.
  let proposedTechnician: User | null = null;
  if (input.proposedTechnicianId) {
    proposedTechnician = await User.findByPk(input.proposedTechnicianId, {
      include: [{ model: TechnicianDetail, as: 'technicianDetail' }],
    });

    if (!proposedTechnician || proposedTechnician.role !== 'technician') {
      throw httpError(404, 'Technician not found');
    }
    if (!proposedTechnician.isActive) {
      throw httpError(400, 'That technician account is deactivated');
    }
  }

  const proposedDate = String(input.proposedDate).trim();
  const reason = input.reason ? String(input.reason).trim() : '';

  // Single-use token so a superseded email link can be recognised as stale.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const now = new Date();

  // Expiry is the earlier of now+48h and the proposed slot's start instant,
  // computed through the one shared helper (Req 10.1, 10.4). If the date/slot
  // can't be resolved, the helper throws a typed field-scoped error; we
  // translate it into the service's own validation shape and bail out *before*
  // mutating or saving the request, so no proposal is created (Req 10.5).
  let expiresAt: Date;
  try {
    expiresAt = computeRescheduleExpiry(now, proposedDate, input.proposedTime);
  } catch (err) {
    const slotError = err as SlotValidationError;
    if (slotError && slotError.statusCode === 400 && slotError.field) {
      throw httpError(400, 'Validation failed', [
        { field: slotError.field, message: slotError.message },
      ]);
    }
    throw err;
  }

  serviceRequest.status = 'needs-rescheduling';
  serviceRequest.proposedDate = proposedDate;
  serviceRequest.proposedTime = input.proposedTime;
  serviceRequest.proposedTechnicianId = input.proposedTechnicianId ?? null;
  serviceRequest.rescheduleReason = reason.length > 0 ? reason : null;
  serviceRequest.rescheduleTokenHash = hashToken(rawToken);
  serviceRequest.rescheduleRequestedAt = now;
  serviceRequest.rescheduleExpiresAt = expiresAt;
  serviceRequest.rescheduleRespondedAt = null;
  serviceRequest.rescheduleDeclineNotes = null;
  await serviceRequest.save();

  // Notify the customer. Delivery failure must not roll back the proposal —
  // the record is already visible in their portal — so the outcome is reported
  // back to the admin instead of thrown.
  const customer = serviceRequest.user;
  const reference = formatRequestReference(serviceRequest.id);
  const recipient = customer?.gmail || customer?.email || '';

  let emailDelivered = false;
  if (recipient) {
    const actionUrl =
      `${getAppBaseUrl()}/my-requests` +
      `?request=${serviceRequest.id}&token=${rawToken}`;

    const result = await sendRescheduleProposalEmail({
      gmail: recipient,
      customerName: customer?.name ?? 'there',
      requestReference: reference,
      serviceType: serviceRequest.serviceType,
      originalSchedule: formatSchedule(
        serviceRequest.serviceRequiredDate,
        serviceRequest.serviceRequiredTime
      ),
      proposedSchedule: formatSchedule(proposedDate, input.proposedTime),
      reason: reason.length > 0 ? reason : null,
      respondByLabel: formatDeadline(expiresAt),
      actionUrl,
    });
    emailDelivered = result.delivered;
  }

  return { serviceRequest, emailDelivered, expiresAt };
}

// --- Respond (customer) ---

/**
 * Applies the customer's accept/decline decision.
 *
 * Accepting promotes the proposal to the real schedule and assigns the
 * technician; declining records the optional notes. A response that arrives
 * after the deadline expires the request instead of being applied.
 */
export async function respondToReschedule(
  input: RespondToRescheduleInput
): Promise<ServiceRequest> {
  if (input.action !== 'accept' && input.action !== 'decline') {
    throw httpError(400, 'Validation failed', [
      { field: 'action', message: "Action must be either 'accept' or 'decline'" },
    ]);
  }

  const notes = input.notes ? String(input.notes).trim() : '';
  if (notes.length > DECLINE_NOTES_MAX_LENGTH) {
    throw httpError(400, 'Validation failed', [
      {
        field: 'notes',
        message: `Notes must not exceed ${DECLINE_NOTES_MAX_LENGTH} characters`,
      },
    ]);
  }

  const serviceRequest = await ServiceRequest.findByPk(input.serviceRequestId);
  if (!serviceRequest) {
    throw httpError(404, 'Service request not found');
  }

  // Customers may only respond to their own request.
  if (serviceRequest.userId !== input.userId) {
    throw httpError(403, 'Access denied');
  }

  if (serviceRequest.status !== 'needs-rescheduling') {
    throw httpError(400, 'This request is not awaiting a reschedule decision');
  }

  // Past the deadline the decision is refused and the request expires, so a
  // late click can't quietly resurrect a stale proposal.
  const now = new Date();
  if (serviceRequest.rescheduleExpiresAt && serviceRequest.rescheduleExpiresAt < now) {
    serviceRequest.status = 'expired';
    serviceRequest.rescheduleTokenHash = null;
    await serviceRequest.save();
    throw httpError(
      410,
      `The ${RESCHEDULE_WINDOW_HOURS}-hour window to respond has passed, so this request has expired.`
    );
  }

  if (input.action === 'decline') {
    serviceRequest.status = 'declined';
    serviceRequest.rescheduleDeclineNotes = notes.length > 0 ? notes : null;
    serviceRequest.rescheduleRespondedAt = now;
    serviceRequest.rescheduleTokenHash = null;
    await serviceRequest.save();
    return serviceRequest;
  }

  // --- Accept ---

  const acceptedDate = serviceRequest.proposedDate;
  const acceptedTime = serviceRequest.proposedTime;

  if (!acceptedDate || !acceptedTime) {
    throw httpError(409, 'This proposal is incomplete. Please contact DVTech.');
  }

  // The proposal becomes the request's required schedule.
  serviceRequest.serviceRequiredDate = acceptedDate;
  serviceRequest.serviceRequiredTime = acceptedTime;
  serviceRequest.status = 'assigned';
  serviceRequest.rescheduleRespondedAt = now;
  serviceRequest.rescheduleTokenHash = null;
  await serviceRequest.save();

  // Move the assignment onto the accepted slot. Reuse the request's existing
  // live schedule row if there is one so history isn't duplicated.
  if (serviceRequest.proposedTechnicianId) {
    const existing = await TechnicianSchedule.findOne({
      where: {
        serviceRequestId: serviceRequest.id,
        status: { [Op.notIn]: ['completed', 'rejected'] },
      },
      order: [['createdAt', 'DESC']],
    });

    if (existing) {
      existing.technicianId = serviceRequest.proposedTechnicianId;
      existing.scheduledDate = acceptedDate;
      existing.scheduledTime = acceptedTime;
      existing.status = 'assigned';
      await existing.save();
    } else {
      await TechnicianSchedule.create({
        technicianId: serviceRequest.proposedTechnicianId,
        serviceRequestId: serviceRequest.id,
        scheduledDate: acceptedDate,
        scheduledTime: acceptedTime,
        status: 'assigned',
        priority: 'medium',
      });
    }
  }

  return serviceRequest;
}

/**
 * Checks an email link's token against the stored hash.
 * Lets the UI tell "this link is out of date" apart from a genuine error.
 */
export async function isRescheduleTokenCurrent(
  serviceRequestId: number,
  rawToken: string
): Promise<boolean> {
  if (!rawToken || rawToken.trim().length === 0) return false;

  const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
    attributes: ['id', 'rescheduleTokenHash'],
  });

  if (!serviceRequest?.rescheduleTokenHash) return false;
  return serviceRequest.rescheduleTokenHash === hashToken(rawToken.trim());
}
