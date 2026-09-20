import { Op } from 'sequelize';
import { AirconProduct } from '../models';
import {
  archiveRecord,
  restoreRecord,
  permanentlyDeleteRecord,
  listArchivedRecords,
} from '../utils/archive';

// --- Types ---

/** Compressor technology, chosen via the Unit Type radio buttons. */
export type ProductUnitType = 'inverter' | 'non-inverter';

export interface CreateProductInput {
  brand: string;
  model: string;
  type: string;
  unitType: ProductUnitType;
  horsepower: number;
  btuCapacity: number;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
  sortWeight?: number;
}

export interface UpdateProductInput {
  brand: string;
  model: string;
  type: string;
  unitType: ProductUnitType;
  horsepower: number;
  btuCapacity: number;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
  sortWeight?: number;
}

export interface FindAllOptions {
  page?: number;
  pageSize?: number;
  type?: string;
  sortByPrice?: 'asc' | 'desc';
  includeInactive?: boolean;
}

export interface PaginatedResult {
  data: AirconProduct[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

// --- Constants ---

const VALID_TYPES = ['split-type', 'window-type', 'floor-standing'];
const VALID_UNIT_TYPES: ProductUnitType[] = ['inverter', 'non-inverter'];
const BRAND_MAX_LENGTH = 100;
const MODEL_MAX_LENGTH = 100;
const IMAGE_URL_MAX_LENGTH = 500;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 20;

// --- Validation ---

/**
 * Validates an unbounded positive numeric field.
 *
 * Products have no upper limit on horsepower, BTU capacity or price — the only
 * things rejected are values that aren't numbers at all (i.e. letters) and
 * negative numbers. Zero is rejected too, since none of these fields is
 * meaningful at zero.
 */
function validatePositiveNumber(
  value: unknown,
  field: string,
  label: string,
  options: { integerOnly?: boolean } = {}
): ValidationError[] {
  if (value === undefined || value === null || value === '') {
    return [{ field, message: `${label} is required` }];
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  if (typeof numeric !== 'number' || Number.isNaN(numeric)) {
    return [{ field, message: `${label} must be a number` }];
  }
  if (!Number.isFinite(numeric)) {
    return [{ field, message: `${label} must be a valid number` }];
  }
  if (numeric < 0) {
    return [{ field, message: `${label} cannot be negative` }];
  }
  if (numeric === 0) {
    return [{ field, message: `${label} must be greater than 0` }];
  }
  if (options.integerOnly && !Number.isInteger(numeric)) {
    return [{ field, message: `${label} must be a whole number` }];
  }

  return [];
}

function validateProductInput(input: CreateProductInput | UpdateProductInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate brand
  if (!input.brand || input.brand.trim().length === 0) {
    errors.push({ field: 'brand', message: 'Brand is required' });
  } else if (input.brand.trim().length > BRAND_MAX_LENGTH) {
    errors.push({ field: 'brand', message: `Brand must not exceed ${BRAND_MAX_LENGTH} characters` });
  }

  // Validate model
  if (!input.model || input.model.trim().length === 0) {
    errors.push({ field: 'model', message: 'Model is required' });
  } else if (input.model.trim().length > MODEL_MAX_LENGTH) {
    errors.push({ field: 'model', message: `Model must not exceed ${MODEL_MAX_LENGTH} characters` });
  }

  // Validate type
  if (!input.type || input.type.trim().length === 0) {
    errors.push({ field: 'type', message: 'Type is required' });
  } else if (!VALID_TYPES.includes(input.type.trim())) {
    errors.push({
      field: 'type',
      message: `Type must be one of: ${VALID_TYPES.join(', ')}`,
    });
  }

  // Validate unitType
  if (!input.unitType || String(input.unitType).trim().length === 0) {
    errors.push({ field: 'unitType', message: 'Unit type is required' });
  } else if (!VALID_UNIT_TYPES.includes(String(input.unitType).trim() as ProductUnitType)) {
    errors.push({
      field: 'unitType',
      message: `Unit type must be one of: ${VALID_UNIT_TYPES.join(', ')}`,
    });
  }

  // Horsepower, BTU capacity and price are deliberately uncapped — the catalog
  // has to cover commercial units, so an arbitrary ceiling would block valid
  // entries. Only genuinely invalid input is rejected: non-numeric (letters)
  // and negative values.
  errors.push(...validatePositiveNumber(input.horsepower, 'horsepower', 'Horsepower'));
  errors.push(
    ...validatePositiveNumber(input.btuCapacity, 'btuCapacity', 'BTU capacity', {
      integerOnly: true,
    })
  );
  errors.push(...validatePositiveNumber(input.price, 'price', 'Price'));

  // Validate imageUrl (optional)
  if (input.imageUrl !== undefined && input.imageUrl !== null) {
    if (typeof input.imageUrl !== 'string') {
      errors.push({ field: 'imageUrl', message: 'Image URL must be a string' });
    } else if (input.imageUrl.length > IMAGE_URL_MAX_LENGTH) {
      errors.push({
        field: 'imageUrl',
        message: `Image URL must not exceed ${IMAGE_URL_MAX_LENGTH} characters`,
      });
    }
  }

  return errors;
}

// --- Service ---

export async function create(input: CreateProductInput): Promise<AirconProduct> {
  // 1. Validate input
  const validationErrors = validateProductInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Create product with is_active = true
  const product = await AirconProduct.create({
    brand: input.brand.trim(),
    model: input.model.trim(),
    type: input.type.trim(),
    unitType: String(input.unitType).trim() as ProductUnitType,
    horsepower: Number(input.horsepower),
    btuCapacity: Number(input.btuCapacity),
    price: Number(input.price),
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    sortWeight: input.sortWeight !== undefined ? Math.trunc(Number(input.sortWeight)) : 0,
    isActive: true,
  });

  return product;
}

export async function findAll(options?: FindAllOptions): Promise<PaginatedResult> {
  const page = options?.page ?? DEFAULT_PAGE;
  const pageSize = Math.min(options?.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = {};

  // Only return active products by default
  if (!options?.includeInactive) {
    where.isActive = true;
  }

  // Filter by type
  if (options?.type) {
    where.type = options.type;
  }

  // Build order clause.
  // Default order promotes admin "best-selling" weighting (higher first), with
  // price as the tie-breaker. When the customer explicitly picks a price sort,
  // honour that as the primary key but still fall back to the weight.
  const order: [string, string][] = [];
  if (options?.sortByPrice) {
    order.push(['price', options.sortByPrice.toUpperCase()]);
    order.push(['sort_weight', 'DESC']);
  } else {
    order.push(['sort_weight', 'DESC']);
    order.push(['price', 'ASC']);
  }

  const { rows, count } = await AirconProduct.findAndCountAll({
    where,
    order,
    limit: pageSize,
    offset,
  });

  return {
    data: rows,
    pagination: {
      page,
      pageSize,
      totalItems: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

export async function findById(id: number): Promise<AirconProduct> {
  const product = await AirconProduct.findByPk(id);
  if (!product) {
    const error = new Error('Product not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  return product;
}

export async function update(id: number, input: UpdateProductInput): Promise<AirconProduct> {
  // 1. Validate input
  const validationErrors = validateProductInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Find the product
  const product = await AirconProduct.findByPk(id);
  if (!product) {
    const error = new Error('Product not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // 3. Update product
  await product.update({
    brand: input.brand.trim(),
    model: input.model.trim(),
    type: input.type.trim(),
    unitType: String(input.unitType).trim() as ProductUnitType,
    horsepower: Number(input.horsepower),
    btuCapacity: Number(input.btuCapacity),
    price: Number(input.price),
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    ...(input.sortWeight !== undefined
      ? { sortWeight: Math.trunc(Number(input.sortWeight)) }
      : {}),
  });

  return product;
}

export async function deactivate(id: number): Promise<AirconProduct> {
  const product = await AirconProduct.findByPk(id);
  if (!product) {
    const error = new Error('Product not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  await product.update({ isActive: false });

  return product;
}

/**
 * Archives a product (soft delete → Archive view). Separate from `deactivate`:
 * deactivating only hides a live product from the catalog, while archiving
 * removes it to a recycle bin for restore or permanent deletion.
 */
export async function archive(id: number): Promise<void> {
  await archiveRecord(AirconProduct, id, 'Product');
}

/** Restores an archived product. */
export async function restore(id: number): Promise<void> {
  await restoreRecord(AirconProduct, id, 'Product');
}

/** Permanently deletes an archived product. */
export async function permanentlyDelete(id: number): Promise<void> {
  await permanentlyDeleteRecord(AirconProduct, id, 'Product');
}

/** Lists archived products, most recently archived first. */
export async function findArchived(): Promise<AirconProduct[]> {
  return listArchivedRecords(AirconProduct);
}
