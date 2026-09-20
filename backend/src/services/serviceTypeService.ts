import { ServiceType } from '../models';
import {
  archiveRecord,
  restoreRecord,
  permanentlyDeleteRecord,
  listArchivedRecords,
} from '../utils/archive';

// --- Types ---

export interface CreateServiceTypeInput {
  name: string;
  description: string;
  price: number;
  sortWeight?: number;
}

export interface UpdateServiceTypeInput {
  name: string;
  description: string;
  price: number;
  sortWeight?: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

// --- Constants ---

const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MIN_LENGTH = 1;
const DESCRIPTION_MAX_LENGTH = 500;
const PRICE_MIN = 0.01;
const PRICE_MAX = 999999.99;

// --- Validation ---

function validateServiceTypeInput(input: CreateServiceTypeInput | UpdateServiceTypeInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate name
  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (input.name.trim().length < NAME_MIN_LENGTH) {
    errors.push({ field: 'name', message: `Name must be at least ${NAME_MIN_LENGTH} character` });
  } else if (input.name.trim().length > NAME_MAX_LENGTH) {
    errors.push({ field: 'name', message: `Name must not exceed ${NAME_MAX_LENGTH} characters` });
  }

  // Validate description
  if (!input.description || input.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Description is required' });
  } else if (input.description.trim().length < DESCRIPTION_MIN_LENGTH) {
    errors.push({ field: 'description', message: `Description must be at least ${DESCRIPTION_MIN_LENGTH} character` });
  } else if (input.description.trim().length > DESCRIPTION_MAX_LENGTH) {
    errors.push({ field: 'description', message: `Description must not exceed ${DESCRIPTION_MAX_LENGTH} characters` });
  }

  // Validate price
  if (input.price === undefined || input.price === null) {
    errors.push({ field: 'price', message: 'Price is required' });
  } else if (typeof input.price !== 'number' || isNaN(input.price)) {
    errors.push({ field: 'price', message: 'Price must be a number' });
  } else if (input.price < PRICE_MIN || input.price > PRICE_MAX) {
    errors.push({
      field: 'price',
      message: `Price must be between ${PRICE_MIN} and ${PRICE_MAX}`,
    });
  }

  return errors;
}

// --- Service ---

export async function create(input: CreateServiceTypeInput): Promise<ServiceType> {
  // 1. Validate input
  const validationErrors = validateServiceTypeInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Create service type with isActive = true
  const serviceType = await ServiceType.create({
    name: input.name.trim(),
    description: input.description.trim(),
    price: input.price,
    sortWeight: input.sortWeight !== undefined ? Math.trunc(Number(input.sortWeight)) : 0,
    isActive: true,
  });

  return serviceType;
}

export interface FindAllOptions {
  /**
   * Include services marked Unavailable. Admin-only: the customer-facing list
   * must never contain them, since an unavailable service is fully blocked.
   */
  includeUnavailable?: boolean;
}

/**
 * Lists services.
 *
 * By default only Available services are returned — that single filter is what
 * keeps an Unavailable service out of the customer's booking dropdown. The admin
 * screen passes `includeUnavailable` so it can still see (and re-enable) them;
 * without that the service would disappear the moment it was switched off and
 * could never be turned back on.
 */
export async function findAll(options: FindAllOptions = {}): Promise<ServiceType[]> {
  const serviceTypes = await ServiceType.findAll({
    where: options.includeUnavailable ? {} : { isActive: true },
    // Admin-controlled priority first (a proxy for "most-availed"), then name.
    order: [
      ['sort_weight', 'DESC'],
      ['name', 'ASC'],
    ],
  });

  return serviceTypes;
}

/**
 * Marks a service Available or Unavailable.
 *
 * Unavailable services are hidden from the customer's booking dropdown and
 * rejected by the create-request validation, so this is a hard block rather
 * than a display-only flag.
 */
export async function setAvailability(id: number, isAvailable: boolean): Promise<ServiceType> {
  const serviceType = await ServiceType.findByPk(id);
  if (!serviceType) {
    const error = new Error('Service type not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  await serviceType.update({ isActive: isAvailable });

  return serviceType;
}

export async function findById(id: number): Promise<ServiceType> {
  const serviceType = await ServiceType.findByPk(id);
  if (!serviceType) {
    const error = new Error('Service type not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  return serviceType;
}

export async function update(id: number, input: UpdateServiceTypeInput): Promise<ServiceType> {
  // 1. Validate input
  const validationErrors = validateServiceTypeInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Find the service type
  const serviceType = await ServiceType.findByPk(id);
  if (!serviceType) {
    const error = new Error('Service type not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // 3. Update service type
  await serviceType.update({
    name: input.name.trim(),
    description: input.description.trim(),
    price: input.price,
    ...(input.sortWeight !== undefined
      ? { sortWeight: Math.trunc(Number(input.sortWeight)) }
      : {}),
  });

  return serviceType;
}

/**
 * Removes a service from the catalog for good.
 *
 * This is a real delete, distinct from marking a service Unavailable — the
 * toggle is the reversible option. Existing service requests keep working
 * because they store the service name as plain text, not a foreign key.
 */
/**
 * Archives a service (soft delete → Archive view), where it can be restored or
 * permanently removed. This is distinct from the Available/Unavailable toggle:
 * that only hides a live service from the customer dropdown, whereas archiving
 * removes it from the catalog entirely. Existing service requests keep working
 * because they store the service name as plain text, not a foreign key.
 */
export async function remove(id: number): Promise<void> {
  await archiveRecord(ServiceType, id, 'Service type');
}

/** Restores an archived service. */
export async function restore(id: number): Promise<void> {
  await restoreRecord(ServiceType, id, 'Service type');
}

/** Permanently deletes an archived service. */
export async function permanentlyDelete(id: number): Promise<void> {
  await permanentlyDeleteRecord(ServiceType, id, 'Service type');
}

/** Lists archived services, most recently archived first. */
export async function findArchived(): Promise<ServiceType[]> {
  return listArchivedRecords(ServiceType);
}
