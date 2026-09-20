import { Quotation, User, ServiceRequest } from '../models';
import {
  AWAITING_SCHEDULING_STATUS,
  QUOTATION_STATUS,
  QUOTATION_STATUS_VALUES,
  type QuotationStatus,
} from '../constants/quotationStatus';

/**
 * Quotation business logic (C4 My Quotations / A6 Manage Quotations — Req 4, 11).
 *
 * Ownership is enforced here in the service layer, not just at the route: the
 * customer-scoped listing filters strictly by the `userId` taken from the JWT
 * (Req 4.7, 4.8), so a customer can never see another customer's quotations
 * even if a route guard were misconfigured. Admin-only access to the
 * cross-customer listing is enforced by `roleMiddleware('admin')` on the route
 * (Req 11.8); this module deliberately exposes the admin listing as a separate
 * function so the two scopes can never be confused.
 *
 * Status vocabulary is read from `constants/quotationStatus` (never a literal),
 * keeping the placeholder swappable in one file when INQUIRY.DOCX arrives
 * (Req 5).
 */

interface HttpError extends Error {
  statusCode: number;
}

function httpError(statusCode: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

/**
 * A single row shaped for the My Quotations / Manage Quotations lists. The
 * customer view uses the customer-facing fields; the admin view additionally
 * carries the owning customer (Req 4.3, 11.2).
 */
export interface QuotationListItem {
  id: number;
  brand: string;
  model: string;
  details: string | null;
  status: QuotationStatus;
  submittedAt: Date;
  serviceRequestId: number | null;
  customer?: {
    id: number;
    name: string;
    email: string;
  };
}

// Newest submission first (Req 4.4, 11.3). A stable secondary key on id keeps
// ordering deterministic when two quotations share a submitted_at instant.
const NEWEST_FIRST: [string, string][] = [
  ['submittedAt', 'DESC'],
  ['id', 'DESC'],
];

/** Maps a Quotation row to the customer list shape (no owner details). */
function toCustomerItem(q: Quotation): QuotationListItem {
  return {
    id: q.id,
    brand: q.brand,
    model: q.model,
    details: q.details,
    status: q.status,
    submittedAt: q.submittedAt,
    serviceRequestId: q.serviceRequestId,
  };
}

/** Maps a Quotation row (with eager-loaded user) to the admin list shape. */
function toAdminItem(q: Quotation): QuotationListItem {
  return {
    ...toCustomerItem(q),
    customer: q.user
      ? { id: q.user.id, name: q.user.name, email: q.user.email }
      : undefined,
  };
}

/**
 * Lists the quotations that belong to the requesting customer, most recent
 * first (Req 4.2, 4.4, 4.7, 4.8).
 *
 * The `where: { userId }` filter is the server-side ownership enforcement: the
 * `userId` must come from the authenticated JWT (supplied by the route), never
 * from a client-provided value, so a customer only ever receives their own
 * quotations.
 */
export async function listMyQuotations(userId: number): Promise<QuotationListItem[]> {
  const rows = await Quotation.findAll({
    where: { userId },
    order: NEWEST_FIRST,
  });
  return rows.map(toCustomerItem);
}

/**
 * Lists every customer's quotations for the admin Manage Quotations view, most
 * recent first (Req 11.2, 11.3). Admin-only access is enforced at the route via
 * `roleMiddleware('admin')` (Req 11.8); this function performs no per-user
 * scoping by design.
 */
export async function listAllQuotations(): Promise<QuotationListItem[]> {
  const rows = await Quotation.findAll({
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email'],
      },
    ],
    order: NEWEST_FIRST,
  });
  return rows.map(toAdminItem);
}

/**
 * Loads a single quotation the caller owns, or throws. Used by the customer
 * details action (Req 4.3) so a customer can only ever view their own
 * quotation, mirroring `serviceRequestService.findOwnedRequest`.
 */
export async function getOwnedQuotation(id: number, userId: number): Promise<Quotation> {
  const quotation = await Quotation.findByPk(id);
  if (!quotation) {
    throw httpError(404, 'Quotation not found');
  }
  if (quotation.userId !== userId) {
    throw httpError(403, 'Access denied');
  }
  return quotation;
}

/**
 * Creates a new quotation for the given customer (C4 "Request Quotation" write
 * path — Req 4). The `userId` is supplied by the caller from the authenticated
 * JWT, never from the client body, so a customer can only ever create a
 * quotation owned by themselves. The status is forced to the placeholder
 * `Submitted` entry state and `submittedAt` is stamped server-side so the row
 * lands at the top of the most-recent-first list.
 */
export async function createQuotation(input: {
  userId: number;
  brand: string;
  model: string;
  details: string | null;
}): Promise<QuotationListItem> {
  const created = await Quotation.create({
    userId: input.userId,
    brand: input.brand.trim(),
    model: input.model.trim(),
    details: input.details && input.details.trim().length > 0 ? input.details.trim() : null,
    status: QUOTATION_STATUS.Submitted,
    submittedAt: new Date(),
  });
  return toCustomerItem(created);
}

/**
 * Admin status transition for a quotation (A6 Manage Quotations — Req 11).
 *
 * Validates `status` against the single-sourced placeholder vocabulary (400 on
 * an unknown value), 404s when the quotation does not exist, then persists the
 * new status and returns the admin-shaped item (with the owning customer).
 *
 * Transitions are intentionally not machine-enforced here: the real state
 * machine is defined by INQUIRY.DOCX (Req 5), so for now any valid status may
 * be set. When the status reaches the Awaiting-Scheduling gate (`Paid`) and the
 * quotation is not yet linked to a service request, a linked, already-approved
 * service request is created from the quotation so it can enter the admin
 * "Requests Awaiting Scheduling" list (Req 11.5, 11.6).
 */
export async function updateQuotationStatus(
  id: number,
  status: QuotationStatus
): Promise<QuotationListItem> {
  if (!QUOTATION_STATUS_VALUES.includes(status)) {
    throw httpError(400, 'Invalid quotation status');
  }

  const quotation = await Quotation.findByPk(id);
  if (!quotation) {
    throw httpError(404, 'Quotation not found');
  }

  quotation.status = status;

  // Paid-gate wiring: when a quotation is marked Paid and has no linked service
  // request yet, create one so it can actually enter scheduling (Req 11.5,
  // 11.6). The linked request is created 'approved' (it has already been paid,
  // so it skips the pending-approval step) and inherits the owning customer's
  // saved address. If the customer has no saved address on file we still create
  // the request but leave the address fields null — the admin can complete them
  // from the scheduling screen — rather than block the Paid transition.
  if (
    isAwaitingScheduling(status) &&
    (quotation.serviceRequestId === null || quotation.serviceRequestId === undefined)
  ) {
    const owner = await User.findByPk(quotation.userId, {
      attributes: ['id', 'street', 'barangay', 'city', 'province', 'contactNumber'],
    });

    const detailSuffix = quotation.details ? ` — ${quotation.details}` : '';
    const linkedRequest = await ServiceRequest.create({
      userId: quotation.userId,
      serviceType: 'Installation',
      acDetails: `${quotation.brand} ${quotation.model}${detailSuffix}`.trim(),
      status: 'approved',
      serviceStreet: owner?.street ?? null,
      serviceBarangay: owner?.barangay ?? null,
      serviceCity: owner?.city ?? null,
      serviceProvince: owner?.province ?? null,
      contactNumber: owner?.contactNumber ?? null,
      installBrand: quotation.brand,
      installModel: quotation.model,
    });

    quotation.serviceRequestId = linkedRequest.id;
  }

  await quotation.save();

  // Reload with the owning customer so the admin list row updates in place.
  const withCustomer = await Quotation.findByPk(quotation.id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email'],
      },
    ],
  });

  return toAdminItem(withCustomer ?? quotation);
}

/**
 * The Paid-gate for the "Requests Awaiting Scheduling" list (Req 11.5, 11.6).
 *
 * A quotation-based request enters scheduling only once its quotation reaches
 * exactly the Awaiting-Scheduling status (`Paid`); any earlier status is
 * excluded. Non-quotation service requests do not pass through this gate and
 * keep their existing scheduling behaviour (Req 11.7). The gate reads the
 * single-sourced `AWAITING_SCHEDULING_STATUS` constant so it swaps in one place
 * with the rest of the vocabulary (Req 5).
 */
export function isAwaitingScheduling(status: QuotationStatus): boolean {
  return status === AWAITING_SCHEDULING_STATUS;
}
