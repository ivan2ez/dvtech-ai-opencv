import { Op } from 'sequelize';
import { ServiceRequest, User, TechnicianSchedule, TechnicianDetail, ServiceType, Quotation } from '../models';
import { expireStaleReschedules } from './rescheduleService';
import { isAwaitingScheduling } from './quotationService';
import {
  archiveRecord,
  restoreRecord,
  permanentlyDeleteRecord,
  listArchivedRecords,
} from '../utils/archive';

// Shared include: the service request's technician schedule(s) with the
// assigned technician (and their details). Newest schedule first so the
// current assignment is at index 0.
const technicianScheduleInclude = {
  model: TechnicianSchedule,
  as: 'technicianSchedules',
  attributes: ['id', 'status', 'priority', 'scheduledDate', 'createdAt'],
  separate: true,
  order: [['createdAt', 'DESC']] as [string, string][],
  include: [
    {
      model: User,
      as: 'technician',
      attributes: ['id', 'name', 'email'],
      include: [
        {
          model: TechnicianDetail,
          as: 'technicianDetail',
          attributes: ['specialization', 'contactNumber', 'availabilityStatus'],
        },
      ],
    },
  ],
};

// --- Types ---

export interface CreateServiceRequestInput {
  serviceType: string;
  acDetails: string;
  serviceStreet?: string | null;
  serviceBarangay?: string | null;
  serviceCity?: string | null;
  serviceProvince?: string | null;
  contactNumber?: string | null;
  installBrand?: string | null;
  installModel?: string | null;
  serviceRequiredDate?: string | null;
  serviceRequiredTime?: string | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

/** Half-day slots a customer can book. */
const TIME_SLOTS = ['morning', 'afternoon'] as const;
type TimeSlot = (typeof TIME_SLOTS)[number];

export interface ListServiceRequestsOptions {
  userId: number;
  role: string;
  page?: number;
  pageSize?: number;
  /**
   * Customer recycle-bin scope. 'active' (default) hides the customer's
   * soft-deleted requests; 'deleted' returns only those. Ignored for admins,
   * whose view is never affected by a customer's personal deletions.
   */
  scope?: 'active' | 'deleted';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// --- Constants ---

const AC_DETAILS_MAX_LENGTH = 1000;
const DEFAULT_PAGE_SIZE = 20;
const REJECTION_REASON_MIN_LENGTH = 10;
const REJECTION_REASON_MAX_LENGTH = 500;

// --- Validation Helpers ---

function validateCreateInput(input: CreateServiceRequestInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate serviceType is present. The value must match an active service
  // name; that existence check is done asynchronously in createServiceRequest.
  if (!input.serviceType || input.serviceType.trim().length === 0) {
    errors.push({ field: 'serviceType', message: 'Service type is required' });
  } else if (input.serviceType.trim().length > 100) {
    errors.push({ field: 'serviceType', message: 'Service type must not exceed 100 characters' });
  }

  // Validate acDetails
  if (!input.acDetails || input.acDetails.trim().length === 0) {
    errors.push({ field: 'acDetails', message: 'AC details are required' });
  } else if (input.acDetails.trim().length > AC_DETAILS_MAX_LENGTH) {
    errors.push({
      field: 'acDetails',
      message: `AC details must not exceed ${AC_DETAILS_MAX_LENGTH} characters`,
    });
  }

  // Validate service address (required). These are checked after any
  // profile-address fallback has been applied by the caller.
  const addressParts: Array<{ field: keyof CreateServiceRequestInput; label: string }> = [
    { field: 'serviceStreet', label: 'Street' },
    { field: 'serviceBarangay', label: 'Barangay' },
    { field: 'serviceCity', label: 'City' },
    { field: 'serviceProvince', label: 'Province' },
  ];
  for (const { field, label } of addressParts) {
    const value = input[field];
    if (!value || String(value).trim().length === 0) {
      errors.push({ field, message: `${label} is required` });
    } else if (String(value).trim().length > 255) {
      errors.push({ field, message: `${label} must not exceed 255 characters` });
    }
  }

  // Validate contact number (required), checked after profile fallback.
  if (!input.contactNumber || String(input.contactNumber).trim().length === 0) {
    errors.push({ field: 'contactNumber', message: 'Contact number is required' });
  } else if (!/^\d{11}$/.test(String(input.contactNumber).trim())) {
    errors.push({ field: 'contactNumber', message: 'Contact number must be exactly 11 digits' });
  }

  // Validate the service required date (required, valid ISO date, not in the past).
  const rawDate = input.serviceRequiredDate ? String(input.serviceRequiredDate).trim() : '';
  if (rawDate.length === 0) {
    errors.push({ field: 'serviceRequiredDate', message: 'Service required date is required' });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    errors.push({ field: 'serviceRequiredDate', message: 'Service required date must be a valid date' });
  } else {
    // Compare date-only values in local terms; today's date is the minimum.
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const parsed = new Date(`${rawDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      errors.push({ field: 'serviceRequiredDate', message: 'Service required date must be a valid date' });
    } else if (rawDate < todayStr) {
      errors.push({ field: 'serviceRequiredDate', message: 'Service required date must be today or later' });
    }
  }

  // The half-day slot is required alongside the date: together they form the
  // "Required Date and Time" the admin schedules against.
  const rawSlot = input.serviceRequiredTime ? String(input.serviceRequiredTime).trim() : '';
  if (rawSlot.length === 0) {
    errors.push({ field: 'serviceRequiredTime', message: 'Preferred time is required' });
  } else if (!TIME_SLOTS.includes(rawSlot as TimeSlot)) {
    errors.push({
      field: 'serviceRequiredTime',
      message: `Preferred time must be one of: ${TIME_SLOTS.join(', ')}`,
    });
  }

  return errors;
}

// --- Service ---

export async function createServiceRequest(
  input: CreateServiceRequestInput,
  userId: number
): Promise<ServiceRequest> {
  // 1. Apply profile-address fallback: when a service address part is blank,
  // use the customer's saved profile address so the admin always has a
  // location to route by.
  const clean = (v: string | null | undefined): string =>
    v === null || v === undefined ? '' : String(v).trim();

  const customer = await User.findByPk(userId, {
    attributes: ['id', 'street', 'barangay', 'city', 'province', 'contactNumber'],
  });

  const resolvedInput: CreateServiceRequestInput = {
    ...input,
    serviceStreet: clean(input.serviceStreet) || clean(customer?.street),
    serviceBarangay: clean(input.serviceBarangay) || clean(customer?.barangay),
    serviceCity: clean(input.serviceCity) || clean(customer?.city),
    serviceProvince: clean(input.serviceProvince) || clean(customer?.province),
    contactNumber: clean(input.contactNumber) || clean(customer?.contactNumber),
  };

  // 2. Validate input (service address now required)
  const validationErrors = validateCreateInput(resolvedInput);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2b. Validate the service type matches an active service (case-insensitive),
  // and use the canonical stored name so it displays consistently.
  const requestedType = resolvedInput.serviceType.trim();
  const activeServices = await ServiceType.findAll({
    where: { isActive: true },
    attributes: ['name'],
  });
  const matchedService = activeServices.find(
    (s) => s.name.trim().toLowerCase() === requestedType.toLowerCase()
  );
  if (!matchedService) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = [{ field: 'serviceType', message: 'Selected service is not available' }];
    throw error;
  }

  // Only persist the AC brand/model selection for Installation requests.
  const isInstallation = matchedService.name.trim().toLowerCase() === 'installation';
  const installBrand = isInstallation && clean(input.installBrand) ? clean(input.installBrand) : null;
  const installModel = isInstallation && clean(input.installModel) ? clean(input.installModel) : null;

  // 3. Create service request with pending status
  const serviceRequest = await ServiceRequest.create({
    userId,
    serviceType: matchedService.name,
    acDetails: resolvedInput.acDetails.trim(),
    status: 'pending',
    serviceStreet: clean(resolvedInput.serviceStreet),
    serviceBarangay: clean(resolvedInput.serviceBarangay),
    serviceCity: clean(resolvedInput.serviceCity),
    serviceProvince: clean(resolvedInput.serviceProvince),
    contactNumber: clean(resolvedInput.contactNumber),
    installBrand,
    installModel,
    serviceRequiredDate: clean(input.serviceRequiredDate) || null,
    serviceRequiredTime: (clean(input.serviceRequiredTime) || null) as TimeSlot | null,
  });

  return serviceRequest;
}

/**
 * Expires any still-`pending` request whose required date has already passed.
 *
 * A request that no one acted on before the day the customer needed it is no
 * longer actionable, so it moves to `expired`. Like the reschedule expiry, this
 * is evaluated lazily on read rather than by a background worker, which keeps it
 * correct on the serverless (Vercel) deployment. `todayStr` uses local calendar
 * date so a request due "today" is not expired until tomorrow.
 */
export async function expireStalePendingRequests(): Promise<number> {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [affected] = await ServiceRequest.update(
    { status: 'expired' },
    {
      where: {
        status: 'pending',
        serviceRequiredDate: { [Op.ne]: null, [Op.lt]: todayStr },
      },
    }
  );
  return affected;
}

export async function listServiceRequests(
  options: ListServiceRequestsOptions
): Promise<PaginatedResult<ServiceRequest>> {
  // Settle any reschedule proposals whose 48-hour window has elapsed, and expire
  // any pending request whose required date has passed, before reading — so both
  // portals always show an accurate status without relying on a background job.
  await expireStaleReschedules();
  await expireStalePendingRequests();

  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  // Build where clause based on role
  const whereClause: Record<string, unknown> = {};
  if (options.role === 'customer') {
    whereClause.userId = options.userId;
    // Apply the customer's personal recycle-bin scope. The admin view (below)
    // never filters on customerDeletedAt, so a customer deleting a row from
    // their list does not hide it from the admin.
    if (options.scope === 'deleted') {
      whereClause.customerDeletedAt = { [Op.ne]: null };
    } else {
      whereClause.customerDeletedAt = { [Op.is]: null };
    }
  }
  // Admin sees all requests — no filter needed

  const { rows, count } = await ServiceRequest.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'street', 'barangay', 'city', 'province'],
      },
      // Technician earmarked for a pending reschedule proposal, so the
      // customer's confirmation modal can name who would be coming.
      {
        model: User,
        as: 'proposedTechnician',
        attributes: ['id', 'name', 'email'],
        required: false,
      },
      technicianScheduleInclude,
    ],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset,
  });

  return {
    data: rows,
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  };
}

/**
 * Lists the requests awaiting scheduling for the admin's "Requests Awaiting
 * Scheduling" list, applying the quotation Paid-gate (Req 11.5, 11.6, 11.7).
 *
 * The base set is approved requests that have no active (non-rejected)
 * technician schedule yet. Non-quotation requests keep their existing
 * behaviour and always appear once approved (Req 11.7). A request that
 * originated from a quotation (there is a `Quotation` row linking to it via
 * `serviceRequestId`) is gated: it enters this list only when its quotation has
 * reached the Awaiting-Scheduling status (`Paid`), and is excluded at any
 * earlier status (Req 11.5, 11.6). The gate reads the single-sourced
 * `isAwaitingScheduling` helper so the status vocabulary swaps in one place
 * (Req 5).
 */
export async function listRequestsAwaitingScheduling(): Promise<ServiceRequest[]> {
  await expireStaleReschedules();
  await expireStalePendingRequests();

  const approvedRequests = await ServiceRequest.findAll({
    where: { status: 'approved' },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'street', 'barangay', 'city', 'province'],
      },
      technicianScheduleInclude,
    ],
    order: [['createdAt', 'DESC']],
  });

  // A request is still awaiting scheduling only if it has no active
  // (non-rejected) technician schedule.
  const unscheduled = approvedRequests.filter((request) => {
    const schedules = (request.technicianSchedules ?? []) as TechnicianSchedule[];
    return !schedules.some((s) => s.status !== 'rejected');
  });

  if (unscheduled.length === 0) {
    return [];
  }

  // Load the quotations that back any of these requests so we can apply the
  // Paid-gate. A request without a matching quotation is a non-quotation
  // request and is not gated.
  const requestIds = unscheduled.map((r) => r.id);
  const quotations = await Quotation.findAll({
    where: { serviceRequestId: { [Op.in]: requestIds } },
    attributes: ['serviceRequestId', 'status'],
  });

  // Map serviceRequestId → quotation status for the gate lookup.
  const quotationStatusByRequestId = new Map<number, Quotation['status']>();
  for (const q of quotations) {
    if (q.serviceRequestId !== null) {
      quotationStatusByRequestId.set(q.serviceRequestId, q.status);
    }
  }

  return unscheduled.filter((request) => {
    const quotationStatus = quotationStatusByRequestId.get(request.id);
    // Non-quotation request: preserve existing behaviour (always eligible).
    if (quotationStatus === undefined) {
      return true;
    }
    // Quotation-based request: gated to the Awaiting-Scheduling status (Paid).
    return isAwaitingScheduling(quotationStatus);
  });
}

export async function getServiceRequestById(
  id: number,
  userId: number,
  role: string
): Promise<ServiceRequest> {
  await expireStaleReschedules();
  await expireStalePendingRequests();

  const serviceRequest = await ServiceRequest.findByPk(id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'street', 'barangay', 'city', 'province'],
      },
      // Technician earmarked for a pending reschedule proposal, so the
      // customer's confirmation modal can name who would be coming.
      {
        model: User,
        as: 'proposedTechnician',
        attributes: ['id', 'name', 'email'],
        required: false,
      },
      technicianScheduleInclude,
    ],
  });

  if (!serviceRequest) {
    const error = new Error('Service request not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // Customers can only view their own requests
  if (role === 'customer' && serviceRequest.userId !== userId) {
    const error = new Error('Access denied') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  return serviceRequest;
}

/**
 * Loads a request and asserts the caller owns it. Used by the customer-scoped
 * recycle-bin actions so a customer can only ever affect their own requests.
 */
async function findOwnedRequest(id: number, userId: number): Promise<ServiceRequest> {
  const serviceRequest = await ServiceRequest.findByPk(id);
  if (!serviceRequest) {
    const error = new Error('Service request not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }
  if (serviceRequest.userId !== userId) {
    const error = new Error('Access denied') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }
  return serviceRequest;
}

/**
 * Moves the customer's own request into their recycle bin (customer-scoped
 * soft delete). The admin's view is unaffected. Idempotent: deleting an
 * already-deleted request just keeps the original timestamp.
 */
export async function softDeleteOwnRequest(id: number, userId: number): Promise<void> {
  const serviceRequest = await findOwnedRequest(id, userId);
  if (!serviceRequest.customerDeletedAt) {
    serviceRequest.customerDeletedAt = new Date();
    await serviceRequest.save();
  }
}

/** Restores a request from the customer's recycle bin back to their list. */
export async function restoreOwnRequest(id: number, userId: number): Promise<void> {
  const serviceRequest = await findOwnedRequest(id, userId);
  if (serviceRequest.customerDeletedAt) {
    serviceRequest.customerDeletedAt = null;
    await serviceRequest.save();
  }
}

/**
 * Permanently deletes the customer's own request. Only allowed from the recycle
 * bin (must be soft-deleted first), mirroring the "deactivate before delete"
 * speed bump used elsewhere so a live row can't be destroyed by one misclick.
 */
export async function permanentlyDeleteOwnRequest(id: number, userId: number): Promise<void> {
  const serviceRequest = await findOwnedRequest(id, userId);
  if (!serviceRequest.customerDeletedAt) {
    const error = new Error(
      'Move this request to the recycle bin before deleting it permanently.'
    ) as Error & { statusCode: number };
    error.statusCode = 409;
    throw error;
  }
  // Hard delete: the customer's "delete permanently" must truly remove the row,
  // not just soft-delete it (the table is now paranoid for the admin archive).
  await serviceRequest.destroy({ force: true });
}

// --- Admin archive (soft delete → Archive view; distinct from the customer's
// own recycle bin, which uses customerDeletedAt) ---

export async function archiveServiceRequest(id: number): Promise<void> {
  await archiveRecord(ServiceRequest, id, 'Service request');
}

export async function restoreServiceRequest(id: number): Promise<void> {
  await restoreRecord(ServiceRequest, id, 'Service request');
}

export async function permanentlyDeleteServiceRequest(id: number): Promise<void> {
  await permanentlyDeleteRecord(ServiceRequest, id, 'Service request');
}

export async function findArchivedServiceRequests(): Promise<ServiceRequest[]> {
  return listArchivedRecords(ServiceRequest);
}

export async function approveServiceRequest(
  id: number,
  role: string
): Promise<ServiceRequest> {
  // 1. Validate role is admin
  if (role !== 'admin') {
    const error = new Error('Only Admin can approve service requests') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  // 2. Find service request by id
  const serviceRequest = await ServiceRequest.findByPk(id);
  if (!serviceRequest) {
    const error = new Error('Service request not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // 3. Validate status is pending
  if (serviceRequest.status !== 'pending') {
    const error = new Error('Only pending requests can be approved') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  // 4. Update status to approved
  serviceRequest.status = 'approved';
  await serviceRequest.save();

  return serviceRequest;
}

export async function rejectServiceRequest(
  id: number,
  role: string,
  reason: string
): Promise<ServiceRequest> {
  // 1. Validate role is admin
  if (role !== 'admin') {
    const error = new Error('Only Admin can reject service requests') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  // 2. Find service request by id
  const serviceRequest = await ServiceRequest.findByPk(id);
  if (!serviceRequest) {
    const error = new Error('Service request not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // 3. Validate status is pending
  if (serviceRequest.status !== 'pending') {
    const error = new Error('Only pending requests can be rejected') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  // 4. Validate rejection reason
  if (!reason || reason.trim().length === 0) {
    const error = new Error('Rejection reason is required') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = [{ field: 'reason', message: 'Rejection reason is required' }];
    throw error;
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length < REJECTION_REASON_MIN_LENGTH) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = [{ field: 'reason', message: `Rejection reason must be at least ${REJECTION_REASON_MIN_LENGTH} characters` }];
    throw error;
  }

  if (trimmedReason.length > REJECTION_REASON_MAX_LENGTH) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = [{ field: 'reason', message: `Rejection reason must not exceed ${REJECTION_REASON_MAX_LENGTH} characters` }];
    throw error;
  }

  // 5. Update status to rejected and persist the reason.
  serviceRequest.status = 'rejected';
  serviceRequest.rejectionReason = trimmedReason;
  await serviceRequest.save();

  return serviceRequest;
}
