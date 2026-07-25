import { ServiceRequest, User } from '../models';

// --- Types ---

export interface CreateServiceRequestInput {
  serviceType: string;
  acDetails: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ListServiceRequestsOptions {
  userId: number;
  role: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// --- Constants ---

const VALID_SERVICE_TYPES = ['installation', 'maintenance', 'repair'];
const AC_DETAILS_MAX_LENGTH = 1000;
const DEFAULT_PAGE_SIZE = 20;
const REJECTION_REASON_MIN_LENGTH = 10;
const REJECTION_REASON_MAX_LENGTH = 500;

// --- Validation Helpers ---

function validateCreateInput(input: CreateServiceRequestInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate serviceType
  if (!input.serviceType || input.serviceType.trim().length === 0) {
    errors.push({ field: 'serviceType', message: 'Service type is required' });
  } else if (!VALID_SERVICE_TYPES.includes(input.serviceType.trim().toLowerCase())) {
    errors.push({
      field: 'serviceType',
      message: `Service type must be one of: ${VALID_SERVICE_TYPES.join(', ')}`,
    });
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

  return errors;
}

// --- Service ---

export async function createServiceRequest(
  input: CreateServiceRequestInput,
  userId: number
): Promise<ServiceRequest> {
  // 1. Validate input
  const validationErrors = validateCreateInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Create service request with pending status
  const serviceRequest = await ServiceRequest.create({
    userId,
    serviceType: input.serviceType.trim().toLowerCase(),
    acDetails: input.acDetails.trim(),
    status: 'pending',
  });

  return serviceRequest;
}

export async function listServiceRequests(
  options: ListServiceRequestsOptions
): Promise<PaginatedResult<ServiceRequest>> {
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  // Build where clause based on role
  const whereClause: Record<string, unknown> = {};
  if (options.role === 'customer') {
    whereClause.userId = options.userId;
  }
  // Admin sees all requests — no filter needed

  const { rows, count } = await ServiceRequest.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email'],
      },
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

export async function getServiceRequestById(
  id: number,
  userId: number,
  role: string
): Promise<ServiceRequest> {
  const serviceRequest = await ServiceRequest.findByPk(id);

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

  // 5. Update status to rejected
  // NOTE: The ServiceRequest model does not currently have a rejection_reason field.
  // The reason is validated but not persisted to the model. A future migration should
  // add a 'rejection_reason' column to the service_requests table to store this value.
  serviceRequest.status = 'rejected';
  await serviceRequest.save();

  return serviceRequest;
}
